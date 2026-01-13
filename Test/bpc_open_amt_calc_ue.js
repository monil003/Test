/**
 * @version v1.0.1
 */

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
            log.debug('error in detecting apply amount changes (maybe for create mode)', error);
        }
    }


    return { afterSubmit };
});

