/**
 * @version v1.0.1
 */

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


    }