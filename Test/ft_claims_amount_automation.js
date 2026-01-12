/**
 * @version v1.0.1
 */

            }


            data.push({
                customerId: customerId,
                paid:       paidVal,
                approved:   approvedVal,
                pending:    pendingVal,
                denied:     deniedVal,
                paidL12:     paidL12,
                approvedL12: approvedL12
            });


            return true; // keep going
        });


        log.debug('getInputData', 'Prepared ' + data.length + ' customer rows from search.');
        return data;
    }


    // ===================== MAP =====================
    function map(context) {
        var row = JSON.parse(context.value);


        var customerId = row.customerId;
        if (!customerId) {
            return;
        }


        try {
            record.submitFields({
                type: record.Type.CUSTOMER,
                id:   customerId,
                values: {
                    // Map “Cases - Paid Claims – YTD” → custentity_ft_paid_claims_ytd
                    custentity_ft_paid_claims_ytd:        row.paid,


                    // Map “Cases - Approved Claims – YTD” → custentity_ft_approved_claims_ytd
                    custentity_ft_approved_claims_ytd:    row.approved,


                    // Map “Cases - Pending Claims” → custentity_ft_pending_claims
                    custentity_ft_pending_claims:         row.pending,


                    // Map “Cases - Denied Claims” → custentity_ft_denied_claims
                    custentity_ft_denied_claims:          row.denied,


                    custentity_ft_approved_claims_l12m: row.approvedL12,
                    custentity_ft_paid_invoices_l12m: row.paidL12,
                },
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });


            log.audit({
                title: 'Customer updated',
                details:
                    'Customer: ' + customerId +
                    ' | Paid='     + row.paid +
                    ' | Approved=' + row.approved +
                    ' | Pending='  + row.pending +
                    ' | Denied='   + row.denied + 
                    ' | ApprovedL12='   + row.approvedL12 + 
                    ' | PaidL12='   + row.paidL12
            });


        } catch (e) {
            log.error({
                title: 'Error updating customer ' + customerId,
                details: e
            });
            // let MR continue; no re-throw
        }
    }


    // We don’t really need reduce for this use-case
    function reduce(context) {}


    // ===================== SUMMARIZE =====================
    function summarize(summary) {
        log.audit('Summary', {
            usage: summary.usage,
            yields: summary.yields,
            concurrency: summary.concurrency
        });


        summary.mapSummary.errors.iterator().each(function (key, error) {
            log.error('Map error for key ' + key, error);
            return true;
        });


        summary.inputSummary.errors.iterator().each(function (key, error) {
            log.error('Input error for key ' + key, error);