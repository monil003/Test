/**
 * @version v1.0.1
 */

/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
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
            let openAmtBase = 0;

            // -----------------------------------------------
            // 1) Return Authorization Logic (special)
            // -----------------------------------------------

            if (recType === record.Type.RETURN_AUTHORIZATION && deleteFlag) return;
              
            if (recType === record.Type.RETURN_AUTHORIZATION || recType === record.Type.ITEM_RECEIPT) {

                let targetRAId = null;
                let exchangeRate = 1;
            
                if (recType === record.Type.ITEM_RECEIPT) {
                    targetRAId = rec.getValue("createdfrom"); 
                    
                    log.debug("Item Receipt created from:", targetRAId);
    
                    if (!targetRAId) {
                        log.debug("No RA found for Item Receipt");
                    }
                }
            
                const calcRecId = (recType === record.Type.RETURN_AUTHORIZATION ? recId : targetRAId);
            
                if (calcRecId) {
            
                    // Load the RA record
                    const raRecord = record.load({
                        type: record.Type.RETURN_AUTHORIZATION,
                        id: calcRecId
                    });

                    if (!raRecord) return;
            
                    let openAmtForeign = 0;
            
                    const lineCount = raRecord.getLineCount({ sublistId: 'item' });
                    exchangeRate = parseFloat(raRecord.getValue('exchangerate')) || 1;
            
                    for (let i = 0; i < lineCount; i++) {
                        const isClosed = raRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'isclosed',
                            line: i
                        });
                        if (isClosed === true || isClosed === 'T') continue;
            
                        const qtyReceived = parseFloat(raRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantityreceived',
                            line: i
                        })) || 0;
            
                        const rate = parseFloat(raRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            line: i
                        })) || 0;
            
                        const qty = parseFloat(raRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'quantity',
                            line: i
                        })) || 0;
            
                        const pendingQty = qty - qtyReceived;

                        log.debug('RA Loggers', {
                          qty: qty,
                          qtyReceived: qtyReceived,
                          rate: rate,
                          pendingQty: pendingQty
                        })
            
                        if (pendingQty > 0) {
                            openAmtForeign += pendingQty * rate;
                        }
                    }
            
                    // const exchangeRate = 1;
                    const openAmtBase = openAmtForeign * exchangeRate;
            
                    // Submit updated fields on RA
                    record.submitFields({
                        type: record.Type.RETURN_AUTHORIZATION,
                        id: calcRecId,
                        values: {
                            custbody_bpc_tm_open_amount_foreign: openAmtForeign,
                            custbody_bpc_tm_open_amount_base: openAmtBase
                        },
                        options: { enableSourcing: false, ignoreMandatoryFields: true }
                    });
            
                    log.debug("Updated RA open amounts", {
                        raId: calcRecId,
                        openAmtForeign,
                        openAmtBase
                    });
                }
            } else {

                // -----------------------------------------------
                // 2) Current Transaction Open Amount Update
                // -----------------------------------------------

                if (recType !== record.Type.CUSTOMER_REFUND && !deleteFlag) {
                    const openAmounts = getOpenAmountsForRecord(recType, recId);

                    openAmtForeign = openAmounts.fxRemaining;
                    openAmtBase = openAmtForeign * openAmounts.exchangeRate;

                    log.debug("Primary Record Values", {
                      openAmtForeign,
                      openAmtBase
                    }); 
                }

                // -----------------------------------------------
                // 3) Update Related Transactions
                // -----------------------------------------------
                try {
                    var related = getAppliedOrApplyingTransactions(rec);

                    if (recType == 'customerpayment') {
                      const paymentReversalInvoicesIds = getPaymentReversalInvoices(recId);
                      // const recentlyUnappliedInvoicesIds = getRecentlyModifiedInvoices(recId);
                      const recentlyUnappliedInvoicesIds = detectApplyAmountChanges(oldRec, rec);

                      log.debug('paymentReversalInvoicesIds', paymentReversalInvoicesIds);
                      log.debug('recentlyUnappliedInvoicesIds', recentlyUnappliedInvoicesIds);

                      if (paymentReversalInvoicesIds && paymentReversalInvoicesIds.length > 0) {
                         related = related.concat(paymentReversalInvoicesIds);

                         // Remove duplicates
                         related = Array.from(new Set(related));
                      }

                      if (recentlyUnappliedInvoicesIds && recentlyUnappliedInvoicesIds.length > 0) {
                         related = related.concat(recentlyUnappliedInvoicesIds);

                         // Remove duplicates
                         related = Array.from(new Set(related));
                      }
                    }

                    if (recType == 'customrecord_bpc_tm_cust_paymt') {
                      const relatedPaymentId = rec.getValue('custrecord_bpc_tm_pymt');
                      const relatedInvoiceId = rec.getValue('custrecord_bpc_tm_invoice');

                      if (relatedPaymentId) related.push(relatedPaymentId);
                      if (relatedInvoiceId) related.push(relatedInvoiceId);
                    }

                    if (recType == 'vendorprepaymentapplication') {
                      const vendorPrePaymentId = rec.getValue('vendorprepayment');
                      log.debug('vendorPrePaymentId', vendorPrePaymentId);
                      related.push(vendorPrePaymentId);
                    }

                    if (recType == 'vendorpayment' || recType == 'vendorcredit' || recType == 'creditmemo') {
                        const recentlyUpdatedSublist = detectApplyAmountChanges(oldRec, rec);

                        if (recentlyUpdatedSublist && recentlyUpdatedSublist.length > 0) {
                            related = related.concat(recentlyUpdatedSublist);

                            // Remove duplicates
                            related = Array.from(new Set(related));
                        }
                    }

                    if (related.length > 0) {
                        log.debug("Processing Related Transactions", related);

                        if (related.length > 50) {
                           const taskObj = task.create({
                            taskType: task.TaskType.MAP_REDUCE
                           });
                           
                          taskObj.scriptId = 'customscript_bpc_trigger_open_amount_mr';
                          taskObj.deploymentId = 'customdeploy_bpc_trigger_open_amount_mr';

                          taskObj.params = {
                            custscript_related_ids: JSON.stringify(related)
                          };

                          const taskId = taskObj.submit();
                          log.debug("Map/Reduce Triggered", taskId); 

                          return;
                        }

                        related.forEach(id => {
                            try {
                                // Detect record type of related transaction
                                const relatedType = getTransactionType(id);
                                if (!relatedType) {
                                    log.error("Unable to detect related type", id);
                                    return;
                                }

                                getOpenAmountsForRecord(relatedType, id);

                            } catch (err) {
                                log.error("Failed updating related record: " + id, err);
                            }
                        });
                    }

                } catch (e) {
                    log.error("Error Updating Related Transactions", e);
                }
            }

            log.debug("Fields Updated Successfully");

        } catch (err) {
            log.error("Error in After Submit", err);
        }
    };

    // ---------------------------------------------------------
    // HELPER: Fetch related applied transactions
    // ---------------------------------------------------------
    function getAppliedOrApplyingTransactions(rec) {
        const relatedIds = [];
        const applySublistId = "apply";
        const applyBillSublistId = "bill";
        const applyCreditSublistId = "credit";
        const applyDepositedSublistId = "deposit";

        const lineCount = rec.getLineCount({ sublistId: applySublistId });
        const billLineCount = rec.getLineCount({ sublistId: applyBillSublistId });

        const creditLineCount = rec.getLineCount({ sublistId: applyCreditSublistId });
        const depositLineCount = rec.getLineCount({ sublistId: applyDepositedSublistId });

        log.debug('lineCount', lineCount);
        log.debug('billLineCount', billLineCount);
      
        if (lineCount) {
           for (let i = 0; i < lineCount; i++) {
            const isApplied = rec.getSublistValue({
                sublistId: applySublistId,
                fieldId: 'apply',
                line: i
            });

            if (isApplied === true || isApplied === 'T') {
                const appliedId = rec.getSublistValue({
                    sublistId: applySublistId,
                    fieldId: 'internalid',
                    line: i
                });
                if (appliedId) relatedIds.push(appliedId);
            }

            // if (rec.type == 'vendorcredit') {
            //     // const appliedId = rec.getSublistValue({
            //     //     sublistId: applySublistId,
            //     //     fieldId: 'internalid',
            //     //     line: i
            //     // });
            //     // if (appliedId) relatedIds.push(appliedId);
            // } else if (isApplied === true || isApplied === 'T') {
            //     const appliedId = rec.getSublistValue({
            //         sublistId: applySublistId,
            //         fieldId: 'internalid',
            //         line: i
            //     });
            //     if (appliedId) relatedIds.push(appliedId);
            // }
          }
        }

        if (billLineCount) {
           for (let i = 0; i < billLineCount; i++) {
            const isApplied = rec.getSublistValue({
                sublistId: applyBillSublistId,
                fieldId: 'apply',
                line: i
            });

            if (isApplied === true || isApplied === 'T') {
                const appliedId = rec.getSublistValue({
                    sublistId: applyBillSublistId,
                    fieldId: 'internalid',
                    line: i
                });
                if (appliedId) relatedIds.push(appliedId);
            }
          }
        }

        if (creditLineCount) {
           for (let i = 0; i < creditLineCount; i++) {
            const isApplied = rec.getSublistValue({
                sublistId: applyCreditSublistId,
                fieldId: 'apply',
                line: i
            });

            if (isApplied === true || isApplied === 'T') {
                const appliedId = rec.getSublistValue({
                    sublistId: applyCreditSublistId,
                    fieldId: 'internalid',
                    line: i
                });
                if (appliedId) relatedIds.push(appliedId);
            }
          }
        }

        if (depositLineCount) {
           for (let i = 0; i < depositLineCount; i++) {
            const isApplied = rec.getSublistValue({
                sublistId: applyDepositedSublistId,
                fieldId: 'apply',
                line: i
            });

            if (isApplied === true || isApplied === 'T') {
                const appliedId = rec.getSublistValue({
                    sublistId: applyDepositedSublistId,
                    fieldId: 'internalid',
                    line: i
                });
                if (appliedId) relatedIds.push(appliedId);
            }
          }
        }

        log.debug('relatedIds', relatedIds);

        return relatedIds;
    }

    // ---------------------------------------------------------
    // HELPER: Get Transaction Type from internal ID
    // ---------------------------------------------------------
    function getTransactionType(id) {
        const result = search.lookupFields({
            type: "transaction",
            id: id,
            columns: ["recordtype"]
        });

        return result.recordtype;
    }

    // ---------------------------------------------------------
    // HELPER: Calculate & Update Open Amounts (foreign & base)
    // ---------------------------------------------------------
    function getOpenAmountsForRecord(recType, recId) {
        let filterIs;

        if (recType === record.Type.CUSTOMER_PAYMENT ||
            recType === record.Type.VENDOR_PREPAYMENT) {
            filterIs = [
                ["internalid", "anyof", recId],
                "AND",
                ["mainline", "is", "F"]
            ];
        } else {
            filterIs = [
                ["internalid", "anyof", recId],
                "AND",
                ["mainline", "is", "T"]
            ];
        }

        let fxRemaining = 0;
        let baseRemaining = 0;
        let fxUnApplied = 0;
        let exchangeRate = 1;

        const transSearch = search.create({
            type: "transaction",
            filters: filterIs,
            columns: [
                'amount',
                'amountpaid',
                'fxamountremaining',
                'amountremaining',
                'exchangerate',
                'fxamount'
            ]
        });

        transSearch.run().each(r => {
            fxRemaining = parseFloat(r.getValue('fxamountremaining')) || 0;
            exchangeRate = parseFloat(r.getValue('exchangerate')) || 1;

            if (recType === record.Type.VENDOR_PREPAYMENT) {
                fxRemaining =
                    (parseFloat(r.getValue('amount')) || 0) -
                    (parseFloat(r.getValue('amountpaid')) || 0);
            } else {
                fxRemaining = parseFloat(r.getValue('fxamountremaining')) || 0;
            }

            fxUnApplied = parseFloat(r.getValue('fxamount')) || 0;
            return false;
        });

        // Calculate values
        const openAmtForeign = fxRemaining;
        const openAmtBase = openAmtForeign * exchangeRate;

        // Save results
        record.submitFields({
            type: recType,
            id: recId,
            values: {
                custbody_bpc_tm_open_amount_foreign: openAmtForeign,
                custbody_bpc_tm_open_amount_base: openAmtBase
            },
            options: { enableSourcing: false, ignoreMandatoryFields: true }
        });

        return {
            fxRemaining,
            baseRemaining,
            fxUnApplied,
            exchangeRate
        };
    }

    // ------------------------------------------------------------------
    // HELPER: Find Vendor Bill which have applied Credits in last 10 min
    // ------------------------------------------------------------------
    function processVendorBillsWithCredits() {
        const vendorbillSearchObj = search.create({
            type: "vendorbill",
            settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
            filters: [
               ["type","anyof","VendBill"], 
               "AND", 
               ["applyingtransaction","noneof","@NONE@"], 
               "AND", 
               ["applyingtransaction.type","anyof","VendCred"], 
               // "AND", 
               // ["status","anyof","VendBill:B"], 
               "AND", 
               ["applyingtransaction.linelastmodifieddate","notbefore","minutesago0","minutesago10"]
               // ["applyingtransaction.linelastmodifieddate","within","today"]
            ],
            columns: [
               search.createColumn({name: "tranid", label: "Document Number"}),
               search.createColumn({name: "applyingtransaction", label: "Applying Transaction"}),
               search.createColumn({
                  name: "trandate",
                  join: "applyingTransaction",
                  label: "Date"
               }),
               search.createColumn({
                  name: "internalid",
                  join: "applyingTransaction",
                  label: "Internal ID"
               })
            ]
        });

        vendorbillSearchObj.run().each(function(result){
            const billId = result.id;
            var billIds = [];
            var creditIds = [];
          
            if (billId) {
                log.debug('Processing Bill', billId);
                billIds.push(billId);
                getOpenAmountsForRecord(record.Type.VENDOR_BILL, billId);
            }

            const creditId = result.getValue({
              name: "internalid",
              join: "applyingTransaction"
            });

            if (creditId) {
              log.debug("Updating Bill Credit", creditId);
              creditIds.push(creditId);

              getOpenAmountsForRecord(record.Type.VENDOR_CREDIT, creditId);
            }
          
            return {
               billIds: billIds,
               creditIds: creditIds
            };
        });
    }

    function getPaymentReversalInvoices(paymentId) {
        var invoiceSet = new Set();

        var searchObj = search.create({
            type: "customrecord_bpc_tm_cust_paymt",
            filters: [
                ["custrecord_bpc_tm_pymt", "anyof", paymentId]
            ],
            columns: [
                search.createColumn({ name: "internalid", join: "CUSTRECORD_BPC_TM_INVOICE" })
            ]
        });

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
                ["linelastmodifieddate","notbefore","minutesago1"]
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
            log.debug('error in detecting apply amount changes');
        }
    }

    return { afterSubmit };
});
