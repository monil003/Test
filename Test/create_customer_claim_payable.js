/**
 * @version v1.0.1
 */



            var searchResultCount = supportcaseSearchObj.runPaged().count;


            log.debug('searchResultCount', searchResultCount);


            if (searchResultCount == 0) {
              log.debug('No approved case found');
            }


            // Run the search
            supportcaseSearchObj.run().each(function(result) {
                try {
                    const caseInternalId = result.id;
                    const caseNumber = result.getValue('casenumber');
                    const title = result.getValue('title');
                    const company = result.getValue('company'); // Customer
                    const approvedAmt = result.getValue('custevent_ft_claim_finapprovamt');
                    const claimDate = result.getValue('startdate');
                    const poNumber = result.getValue({name: 'custevent_ft_claim_ponum'});
                    const claimType = result.getText('custevent_ft_case_claimtype');
                    const claimSummary = result.getValue('custevent_ft_case_claimsummary');
                    const approvalDate = result.getValue('custevent_ft_case_appdate');
                    const approvalReason = result.getValue('custevent_ft_case_clapprovreason');
                    const proNumber = result.getValue('custevent_ft_claim_pronum');
                    var finalDropLoadNumber = result.getValue('custevent_ft_case_finaldropload');
                    const claimTotal = result.getValue('custevent_ft_claim_total');
                    const customerOrderNumber = result.getValue('custevent_ft_order');
                    const caseRCBrokerId = result.getValue('custevent_ft_claim_rcbroker');
                    const caseOrderLocation = result.getValue({name: "location", join: "CUSTEVENT_FT_ORDER"});
                    const caseOrderDepartment = result.getValue({name: "department", join: "CUSTEVENT_FT_ORDER"});
                    const caseOrderFTMaster = result.getValue({name: "custbody_ft_ftmasterjob", join: "CUSTEVENT_FT_ORDER"});


                    log.debug('Data Obj', {
                        company: company,
                        claimDate: claimDate,
                        caseInternalId: caseInternalId,
                        claimType: claimType,
                        approvedAmt: approvedAmt,
                        poNumber: poNumber,
                        approvalReason: approvalReason,
                        approvalDate: approvalDate,
                        caseNumber: caseNumber,
                        claimTotal: claimTotal,
                        finalDropLoadNumber: finalDropLoadNumber,
                        caseOrderLocation: caseOrderLocation,
                        caseOrderDepartment: caseOrderDepartment,
                        caseOrderFTMaster: caseOrderFTMaster
                    });


                    if (finalDropLoadNumber) {
                      var dropLoadNumLookup = search.lookupFields({
                        type: 'purchaseorder',
                        id: finalDropLoadNumber,
                        columns: ['tranid']
                      });
                      finalDropLoadNumber = dropLoadNumLookup.tranid ? dropLoadNumLookup.tranid : finalDropLoadNumber;
                    }


                    // return;


                    // Create a new Custom Transaction (customsale119)
                    const customTrans = record.create({
                        type: 'customsale119',
                        isDynamic: true
                    });


                    customTrans.setValue({ fieldId: 'entity', value: company }); // customer/company
                    // customTrans.setValue({ fieldId: 'trandate', value: new Date(claimDate) });
                    customTrans.setValue({ fieldId: 'trandate', value: new Date() });
                    // customTrans.setValue({ fieldId: 'memo', value: claimSummary });
                    customTrans.setValue({ fieldId: 'custbody_ft_carrclaim_relatedcustclaim', value: caseInternalId }); // reference back to support case
                    customTrans.setValue({ fieldId: 'custbody_claim_type', value: claimType });
                    customTrans.setValue({ fieldId: 'custbody_approved_amount', value: approvedAmt });
                    customTrans.setValue({ fieldId: 'otherrefnum', value: poNumber });
                    customTrans.setValue({ fieldId: 'custbody_approval_reason', value: approvalReason });
                    customTrans.setValue({ fieldId: 'custbody_ft_claim_incident_date', value: new Date(approvalDate) });
                    customTrans.setValue({ fieldId: 'custbody_case_number', value: caseNumber });
                    customTrans.setValue({ fieldId: 'custbody_ft_claimamount', value: claimTotal }); 
                    // customTrans.setValue({ fieldId: 'custbody_ft_claimamount', value: proNumber });
                    customTrans.setValue({ fieldId: 'custbody_ft_load_no', value: finalDropLoadNumber });