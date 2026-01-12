/**
 * @version v1.0.1
 */

/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/log'],
function (search, record, log) {




    // const SUPPORT_CASE_SEARCH_ID = 'customsearch_claim_paid_report';
    const SUPPORT_CASE_SEARCH_ID = 'customsearch_claim_paid_report_3';


    // ===================== GET INPUT DATA =====================
    function getInputData() {
        var data = [];


        // Load your summary search on supportcase
        var scSearch = search.load({
            id: SUPPORT_CASE_SEARCH_ID
        });


        scSearch.run().each(function (result) {


            // 1) Customer internal ID (GROUP on customer.internalid)
            var customerId = result.getValue({
                name: 'internalid',
                join: 'customer',
                summary: search.Summary.GROUP
            });


            if (!customerId) {
                return true;
            }


            // 2) Grab all "Cases - ..." summary columns
            var cols = result.columns;


            var paidVal     = 0;
            var approvedVal = 0;
            var pendingVal  = 0;
            var deniedVal   = 0;
            var paidL12     = 0;
            var approvedL12 = 0;


            for (var i = 0; i < cols.length; i++) {
                var col   = cols[i];
                var label = (col.label || '').toLowerCase();


                // We only care about the "Cases - ..." 
                if (label.indexOf('cases') !== 0) {
                    continue;
                }


                var raw = result.getValue(col);
                var num = Number(raw || 0) || 0;


                if (label.indexOf('l12') > -1 || label.indexOf('last 12') > -1) {


                    if (label.indexOf('paid claims') > -1) {
                       paidL12 = num;
                    } else if (label.indexOf('approved claims') > -1) {
                       approvedL12 = num;
                    }


                    // ----- YTD (default) -----
                } else {


                    if (label.indexOf('paid claims') > -1) {
                       paidVal = num;
                    } else if (label.indexOf('approved claims') > -1) {
                       approvedVal = num;
                    } else if (label.indexOf('pending claims') > -1) {
                       pendingVal = num;
                    } else if (label.indexOf('denied claims') > -1) {
                       deniedVal = num;
                    }
                }


                // Match based on label text
                // if (label.indexOf('paid claims') > -1) {
                //     paidVal = num;
                // } else if (label.indexOf('approved claims') > -1) {
                //     approvedVal = num;