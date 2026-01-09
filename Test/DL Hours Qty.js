/**
 * @version v1.0.1
 */

/**
* @NApiVersion 2.x
* @NScriptType UserEventScript
*/
define(['N/record', 'N/log', 'N/search'], function (record, log, search) {
  function afterSubmit(context) {
    try {
      // Ensure the script runs only on CREATE or EDIT test2
      if (context.type === context.UserEventType.CREATE || context.type === context.UserEventType.EDIT) {
        var newRecord = context.newRecord;
        var recordId = newRecord.id;
        
        log.debug('Work Order Record', 'Record ID: ' + recordId);
        
        // Get the value from custbody_mfgmob_workcenter
        var workCenterId = newRecord.getValue({ fieldId: 'custbody_mfgmob_workcenter' });
        if (workCenterId) {
          // Update the job field with the workCenterId
          record.submitFields({
            type: 'workorder',
            id: recordId,
            values: {
            custbody_tc_work_center_id: workCenterId
            }
          });
          log.debug('Updated Job Field', 'Work Center ID: ' + workCenterId);
        }
        
        var targetQuantity = 0;
        var workorderSearchObj = search.create({
          type: "workorder",
          settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
          filters:
          [
            ["type","anyof","WorkOrd"],
            "AND",