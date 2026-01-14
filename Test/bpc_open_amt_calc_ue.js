/**
 * @version v1.0.3
 */

        searchObj.run().each(function (result) {
            var invId = result.getValue({
                name: "internalid",
                join: "CUSTRECORD_BPC_TM_INVOICE"
            });


            if (invId) {
                invoiceSet.add(invId);
            }
            return true;
        });


        return Array.from(invoiceSet);
    }


    function getRecentlyModifiedInvoices(applyingTransactionId) {
        var invoiceSet = new Set();


        var invoiceSearchObj = search.create({
            type: "invoice",
            settings: [
                { "name": "consolidationtype", "value": "ACCTTYPE" }
            ],
            filters: [
                ["type", "anyof", "CustInvc"],
                "AND",
                ["linelastmodifieddate", "notbefore", "minutesago1"]
            ],
            columns: [
                search.createColumn({ name: "internalid" }),
                search.createColumn({ name: "tranid" }),
                search.createColumn({
                    name: "linelastmodifieddate",
                    join: "applyingTransaction"
                })
            ]
        });


        invoiceSearchObj.run().each(function (result) {
            var invId = result.getValue({ name: "internalid" });
            if (invId) {
                invoiceSet.add(invId);
            }
            return true;
        });


        return Array.from(invoiceSet);
    }


    function detectApplyAmountChanges(oldRec, newRec) {
        try {
            const changes = [];
            const changeInvoiceIds = [];


            const lineCount = newRec.getLineCount({ sublistId: 'apply' });


            for (let i = 0; i < lineCount; i++) {


                const invoiceId = newRec.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'internalid',
                    line: i
                });


                if (!invoiceId) continue;


                // Applied flag (old and new)
                const oldApplied = oldRec.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'apply',
                    line: i
                }) === true || oldRec.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'apply',
                    line: i
                }) === 'T';


                const newApplied = newRec.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'apply',
                    line: i
                }) === true || newRec.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'apply',
                    line: i
                }) === 'T';


                // Amounts (old & new)
                const oldAmount = parseFloat(oldRec.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'amount',
                    line: i
                })) || 0;


                const newAmount = parseFloat(newRec.getSublistValue({
                    sublistId: 'apply',
                    fieldId: 'amount',
                    line: i
                })) || 0;


                // NEW LOGIC:
                // Capture only rows where something actually changed
                const amountChanged = oldAmount !== newAmount;
                const appliedChanged = oldApplied !== newApplied;


                if (amountChanged || appliedChanged) {
                    changes.push({
                        invoiceId,
                        oldApplied,
                        newApplied,
                        oldAmount,
                        newAmount
                    });
                    changeInvoiceIds.push(invoiceId);
                }
            }


            log.debug('changes', changes);
            log.debug('changeInvoiceIds', changeInvoiceIds);


            return changeInvoiceIds;
        } catch (error) {
            log.debug('Fail to detect unapplied');
        }
    }


    return { afterSubmit };
});

