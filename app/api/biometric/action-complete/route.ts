import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  try {
    // 1. API Key Protection
    const apiKey = request.headers.get('x-api-key');
    const configuredKey = process.env.BIOMETRIC_API_KEY;
    if (configuredKey && apiKey !== configuredKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { 
      commandId, 
      command_id,
      memberId, 
      member_id,
      biometricId, 
      biometric_id, 
      action,
      status, // 'executing', 'verifying', 'completed', 'failed', or backward 'success'
      device_response,
      deviceResponse,
      verification_result,
      verificationResult,
      execution_time_ms,
      executionTimeMs,
      error_message,
      errorMessage,
      completed_at,
      completedAt
    } = body;

    const actualCommandId = commandId || command_id;
    const actualMemberId = memberId || member_id;
    const actualBiometricId = biometricId || biometric_id;
    
    // Normalize status values for backward compatibility
    let targetStatus = status || 'completed';
    if (targetStatus === 'success') {
      targetStatus = 'completed';
    }

    const adminSupabase = createAdminClient();

    // 3. Resolve which action record we are updating
    let actionRecord: any = null;

    if (actualCommandId) {
      const { data, error } = await adminSupabase
        .from('biometric_actions')
        .select('*')
        .eq('id', actualCommandId)
        .maybeSingle();
      if (!error && data) {
        actionRecord = data;
      }
    }

    if (!actionRecord && (actualMemberId || actualBiometricId) && action) {
      // Find oldest active matching action
      let query = adminSupabase
        .from('biometric_actions')
        .select('*')
        .eq('action', action)
        .in('status', ['pending', 'sent', 'executing', 'verifying']);

      if (actualMemberId) {
        query = query.or(`member_id.eq.${actualMemberId},staff_id.eq.${actualMemberId}`);
      } else if (actualBiometricId) {
        query = query.eq('biometric_id', actualBiometricId);
      }

      const { data, error } = await query
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        actionRecord = data;
      }
    }

    if (!actionRecord) {
      // If we still can't find it, we might be dealing with an older sync agent or direct notification
      return NextResponse.json({ error: 'Matching active biometric action not found' }, { status: 404 });
    }

    const oldStatus = actionRecord.status;
    const actionId = actionRecord.id;
    const isTerminalState = ['completed', 'failed'].includes(targetStatus);

    // 4. Update the biometric action record
    const updatePayload: any = {
      status: targetStatus,
      device_response: device_response || deviceResponse || actionRecord.device_response,
      verification_result: verification_result || verificationResult || actionRecord.verification_result,
      execution_time_ms: execution_time_ms || executionTimeMs || actionRecord.execution_time_ms,
      error_message: error_message || errorMessage || actionRecord.error_message,
      updated_at: new Date().toISOString()
    };

    if (isTerminalState) {
      updatePayload.completed_at = completed_at || completedAt || new Date().toISOString();
      updatePayload.verification_timestamp = new Date().toISOString();
    }

    const { error: updateErr } = await adminSupabase
      .from('biometric_actions')
      .update(updatePayload)
      .eq('id', actionId);

    if (updateErr) {
      console.error('Error updating biometric action:', updateErr);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    // 5. If terminal state, update member/staff cache profiles and audit trail
    if (isTerminalState) {
      const isCompleted = targetStatus === 'completed';
      const entityId = actionRecord.member_id || actionRecord.staff_id;
      const isStaff = !!actionRecord.staff_id;
      const tableTarget = isStaff ? 'staff' : 'members';

      let nextBiometricStatus = actionRecord.biometric_status || 'ENABLED';
      if (isCompleted) {
        if (actionRecord.action === 'enable') {
          nextBiometricStatus = 'ENABLED';
        } else if (actionRecord.action === 'disable') {
          nextBiometricStatus = actionRecord.disable_method === 'delete' ? 'DELETED' : 'BLOCKED';
        }
      } else {
        // Command failed verification
        nextBiometricStatus = actionRecord.action === 'enable' ? 'DISABLED' : 'ENABLED';
      }

      // Update entity cache columns
      await adminSupabase
        .from(tableTarget)
        .update({
          biometric_status: nextBiometricStatus,
          biometric_last_sync: new Date().toISOString(),
          biometric_last_verification: new Date().toISOString(),
          biometric_last_device_response: updatePayload.device_response || updatePayload.verification_result
        })
        .eq('id', entityId);

      // Fetch name for audit log
      let entityName = 'Unknown';
      const { data: profileData } = await adminSupabase
        .from(tableTarget)
        .select('full_name')
        .eq('id', entityId)
        .maybeSingle();
      if (profileData) {
        entityName = profileData.full_name;
      }

      // Write to Biometric Audit Log
      await adminSupabase
        .from('biometric_audit_logs')
        .insert({
          member_id: isStaff ? null : entityId,
          staff_id: isStaff ? entityId : null,
          entity_type: isStaff ? 'staff' : 'member',
          entity_name: entityName,
          biometric_id: actionRecord.biometric_id,
          action: actionRecord.action,
          device_id: actionRecord.notes || 'eSSL X990',
          operator: actionRecord.notes && actionRecord.notes.includes('TEST') ? 'Test Operator' : 'System/Agent',
          timestamp: new Date().toISOString(),
          command: actionRecord.action === 'disable' ? `disable (${actionRecord.disable_method})` : actionRecord.action,
          verification_result: updatePayload.verification_result || 'Success',
          execution_time_ms: updatePayload.execution_time_ms,
          old_status: oldStatus,
          new_status: targetStatus
        });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Unhandled POST action-complete error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
