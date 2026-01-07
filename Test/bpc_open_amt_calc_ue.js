/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @version v1.0.1
 */
define(['N/record', 'N/search', 'N/log', 'N/task'], (record, search, log, task) => {


    const afterSubmit = (context) => {
        try {
            var rec = context.newRecord;
            var oldRec = context.oldRecord;
            const recId = rec.id;
            const recType = rec.type;
            var deleteFlag = false;


            if (context.type === context.UserEventType.DELETE) {
                rec = context.oldRecord;
                deleteFlag = true;
            }


            log.debug("After Submit Triggered", { recType, recId });


            try {


                if (recId == '0' && recType == 'vendorpayment') {
                    log.debug('Full credit apply case');


                    processVendorBillsWithCredits();


                    return;
                }


            } catch (error) {
                log.debug('error', error);
            }


            let openAmtForeign = 0;