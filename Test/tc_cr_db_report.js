/**
 * @version v1.0.1
 */

/**
 * @NScriptType Suitelet
 */

function suitelet(request, response) {

    if (request.getMethod() === 'GET') {

        var form = nlapiCreateForm('Last 12 Months Debit & Credit Report');

        var drillAccountId = request.getParameter('accountid');

        if (drillAccountId) {
          // Show subaccount report
          showSubaccountReport(drillAccountId, form);
        }

        var sublist = form.addSubList('custpage_report', 'list', 'Report');
        sublist.addField('date', 'date', 'Date');
        sublist.addField('type', 'text', 'Type');
        sublist.addField('tranid', 'text', 'Document No');
        sublist.addField('account', 'text', 'Account');
        sublist.addField('debit', 'currency', 'Debit');
        sublist.addField('credit', 'currency', 'Credit');
        sublist.addField('entity', 'text', 'Entity');
        sublist.addField('memo', 'text', 'Memo');

        const oneYearAgo = getOneYearAgoDate();

        nlapiLogExecution(
           'DEBUG',
           'One year ago date',
           oneYearAgo
        );

        var filters = [];
        filters.push(new nlobjSearchFilter('posting', null, 'is', 'T'));
        filters.push(new nlobjSearchFilter('trandate', null, 'onorafter', oneYearAgo));

        var columns = [];
        columns.push(new nlobjSearchColumn('trandate'));
        columns.push(new nlobjSearchColumn('type'));
        columns.push(new nlobjSearchColumn('tranid'));
        columns.push(new nlobjSearchColumn('account'));
        columns.push(new nlobjSearchColumn('debitamount'));
        columns.push(new nlobjSearchColumn('creditamount'));
        columns.push(new nlobjSearchColumn('entity'));
        columns.push(new nlobjSearchColumn('memo'));

        var search = nlapiCreateSearch('transaction', filters, columns);
        var resultSet = search.runSearch();

        nlapiLogExecution(
           'DEBUG',
           'Fetching Results',
           search
        );

        var start = 0;
        var batchSize = 1000;
        var line = 1;

        do {
            var results = resultSet.getResults(start, start + batchSize);

            nlapiLogExecution('DEBUG', 'Batch', 'Start: ' + start + ', Fetched: ' + (results ? results.length : 0));

            if (!results || results.length === 0) {
                break;
            }

            for (var i = 0; i < results.length; i++) {
                var result = results[i];

                var accountId = result.getValue('account'); // internal ID
                var accountName = result.getText('account');

                // Create clickable link for drilldown
                var drillUrl = nlapiResolveURL('SUITELET', 'customscript_tc_credit_debit_report', 'customdeploy_tc_credit_debit_report') +
               '&accountid=' + accountId;

                var linkHTML = '<a href="' + url + '">' + accountName + '</a>';

                sublist.setLineItemValue('date', line, result.getValue('trandate'));
                sublist.setLineItemValue('type', line, result.getText('type'));
                sublist.setLineItemValue('tranid', line, result.getValue('tranid'));
                sublist.setLineItemValue('account', line, result.getText('account'));
                // sublist.setLineItemLink('account', line, drillUrl);
                sublist.addField('account_link', 'inlinehtml', 'Account');
                sublist.setLineItemValue('account_link', line, linkHTML);

                var debit = result.getValue('debitamount');
                var credit = result.getValue('creditamount');

                if (debit && debit !== '0.00') {
                    sublist.setLineItemValue('debit', line, debit);
                }

                if (credit && credit !== '0.00') {
                    sublist.setLineItemValue('credit', line, credit);
                }

                sublist.setLineItemValue('entity', line, result.getText('entity'));
                sublist.setLineItemValue('memo', line, result.getValue('memo'));

                line++;

                // Prevent exceeding 1000 lines in sublist
                if (line > 1000) {
                    nlapiLogExecution('AUDIT', 'Limit reached', 'Max 1000 lines per sublist');
                    break;
                }
            }

            start += batchSize;

            // Stop if we reached sublist limit
            if (line > 1000) break;

        } while (true);

        response.writePage(form);
    }

    function getOneYearAgoDate() {
        var d = new Date();
        d.setFullYear(d.getFullYear() - 1);

        return nlapiDateToString(d); // returns M/d/yy
    }

    function showSubaccountReport(parentAccountId, form) {

        form.setTitle('Subaccount Report for Account ID: ' + parentAccountId);

        var sublist = form.addSubList('custpage_subreport', 'list', 'Subaccount Report');
        sublist.addField('date', 'date', 'Date');
        sublist.addField('type', 'text', 'Type');
        sublist.addField('tranid', 'text', 'Tran ID');
        sublist.addField('subaccount', 'text', 'Subaccount');
        sublist.addField('debit', 'currency', 'Debit');
        sublist.addField('credit', 'currency', 'Credit');
        sublist.addField('entity', 'text', 'Entity');
        sublist.addField('memo', 'text', 'Memo');

        var filters = [];
        filters.push(new nlobjSearchFilter('posting', null, 'is', 'T'));
        filters.push(new nlobjSearchFilter('trandate', null, 'onorafter', getOneYearAgoDate()));
        filters.push(new nlobjSearchFilter('account', null, 'anyof', parentAccountId)); // only subaccounts of this account

        var columns = [];
        columns.push(new nlobjSearchColumn('trandate'));
        columns.push(new nlobjSearchColumn('type'));
        columns.push(new nlobjSearchColumn('tranid'));
        columns.push(new nlobjSearchColumn('account')); // this will show subaccount name
        columns.push(new nlobjSearchColumn('debitamount'));
        columns.push(new nlobjSearchColumn('creditamount'));
        columns.push(new nlobjSearchColumn('entity'));
        columns.push(new nlobjSearchColumn('memo'));

        var search = nlapiCreateSearch('transaction', filters, columns);
        var resultSet = search.runSearch();

        var line = 1;
        var start = 0;
        var batchSize = 1000;

        do {
            var results = resultSet.getResults(start, start + batchSize);
            if (!results || results.length === 0) break;

            for (var i = 0; i < results.length; i++) {
                var result = results[i];

                sublist.setLineItemValue('date', line, result.getValue('trandate'));
                sublist.setLineItemValue('type', line, result.getText('type'));
                sublist.setLineItemValue('tranid', line, result.getValue('tranid'));
                sublist.setLineItemValue('subaccount', line, result.getText('account'));

                var debit = result.getValue('debitamount');
                var credit = result.getValue('creditamount');

                if (debit && debit !== '0.00') sublist.setLineItemValue('debit', line, debit);
                if (credit && credit !== '0.00') sublist.setLineItemValue('credit', line, credit);

                sublist.setLineItemValue('entity', line, result.getText('entity'));
                sublist.setLineItemValue('memo', line, result.getValue('memo'));

                line++;
                if (line > 1000) break; // max lines
            }

            start += batchSize;
            if (line > 1000) break;

        } while (true);
    }
}
