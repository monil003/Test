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
      // Ensure the script runs only on CREATE or EDIT test
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
            ["item.name","contains","DL Rate - Extrusion"],
            "AND",
            ["internalid","anyof",recordId]
          ],
          columns:
          [
            search.createColumn({
              name: "quantity",
              summary: "SUM",
              label: "Quantity"
            })
          ]
        });
        var searchResultCount = workorderSearchObj.runPaged().count;
        log.debug("workorderSearchObj result count",searchResultCount);
        workorderSearchObj.run().each(function(result){

          targetQuantity = result.getValue({
              name: "quantity",
              summary: "SUM",
              label: "Quantity"
            });
            
          return true;
        });

        log.debug('Quantity for Item 2059', targetQuantity);
        
        // Update custbody_tc_total_dl_hrs_qty with the quantity of item ID 2059
        record.submitFields({
          type: 'workorder',
          id: recordId,
          values: {
            custbody_tc_total_dl_hrs_qty: targetQuantity 
          }
        });
        
        log.debug('Updated Total Quantity Field', 'Quantity for Item 2059: ' + targetQuantity);
      }
    } catch (e) {
      log.error('Error in After Submit Script', e.message);
    }
  }
  
  return {
    afterSubmit: afterSubmit
  };
});
