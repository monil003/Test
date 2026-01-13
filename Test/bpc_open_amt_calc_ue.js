/**
 * @version v1.0.1
 */

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
                            related = related.concat(recentlyUpdatedBillCreidtIds);


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
            log.debug('error in detecting apply amount changes');