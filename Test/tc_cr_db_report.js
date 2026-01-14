/**
 * @version v1.0.1
 */

/**
 * @NScriptType Suitelet
 */
function suitelet(request, response) {
    var form = nlapiCreateForm('Last 12 Months Debit & Credit Report');

    // Check if we are drilling down into a specific account
    var drillAccountId = request.getParameter('accountid');

    // Function to calculate 1 year ago date
    function getOneYearAgoDate() {
        var d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return nlapiDateToString(d); // returns M/d/yy
    }

    if (drillAccountId) {
        // === SUBACCOUNT REPORT ===
        form.setTitle('Subaccount Report');

        // Back button
        form.addButton('custpage_back', 'Back', 'window.location.href="' +
            nlapiResolveURL('SUITELET','customscript_tc_credit_debit_report','customdeploy_tc_credit_debit_report') + '"');

        var sublist = form.addSubList('custpage_subreport', 'list', 'Subaccount Report');
        sublist.addField('date', 'date', 'Date');
        sublist.addField('type', 'text', 'Type');
        sublist.addField('tranid', 'text', 'Tran ID');
        sublist.addField('subaccount', 'text', 'Subaccount');
        sublist.addField('debit', 'currency', 'Debit');
        sublist.addField('credit', 'currency', 'Credit');
        sublist.addField('entity', 'text', 'Entity');
        sublist.addField('memo', 'text', 'Memo');

        var filters = [
            new nlobjSearchFilter('posting', null, 'is', 'T'),
            new nlobjSearchFilter('trandate', null, 'onorafter', getOneYearAgoDate()),
            new nlobjSearchFilter('account', null, 'anyof', drillAccountId)
        ];

        var columns = [
            new nlobjSearchColumn('trandate'),
            new nlobjSearchColumn('type'),
            new nlobjSearchColumn('tranid'),
            new nlobjSearchColumn('account'),
            new nlobjSearchColumn('debitamount'),
            new nlobjSearchColumn('creditamount'),
            new nlobjSearchColumn('entity'),
            new nlobjSearchColumn('memo')
        ];

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
                if (line > 1000) break;
            }

            start += batchSize;
            if (line > 1000) break;
        } while (true);

    } else {
        // === MAIN ACCOUNT REPORT ===
        form.setTitle('Last 12 Months Debit & Credit Report');

        // Add dropdown for drilldown
        var accountSelect = form.addField('custpage_account_filter', 'select', 'Drill Down by Account');
        accountSelect.addSelectOption('', 'Select an account');

        // First, get all unique accounts from transactions in last year
        var filters = [
            new nlobjSearchFilter('posting', null, 'is', 'T'),
            new nlobjSearchFilter('trandate', null, 'onorafter', getOneYearAgoDate())
        ];

        var columns = [
            new nlobjSearchColumn('account'), // unique accounts
        ];

        var search = nlapiCreateSearch('transaction', filters, columns);
        var resultSet = search.runSearch();
        var accounts = resultSet.getResults(0, 1000); // max 1000 unique accounts
        var results;
        var accountMap = {}; // key = accountId, value = accountName

        do {
            results = resultSet.getResults(start, start + batchSize);
            if (!results || results.length === 0) break;

            for (var i = 0; i < results.length; i++) {
                var accountId = results[i].getValue('account');
                var accountName = results[i].getText('account');
                if (!accountMap[accountId]) {
                    accountMap[accountId] = accountName; // add only if not exists
                }
            }

            start += batchSize;
        } while (results && results.length > 0);

        // Now populate dropdown
        var accountSelect = form.addField('custpage_account_filter', 'select', 'Drill Down by Account');
        accountSelect.addSelectOption('', 'Select an account');

        for (var id in accountMap) {
            accountSelect.addSelectOption(id, accountMap[id]);
        }

        form.addSubmitButton('View Subaccounts');

        // Main sublist
        var sublist = form.addSubList('custpage_report', 'list', 'Report');
        sublist.addField('date', 'date', 'Date');
        sublist.addField('type', 'text', 'Type');
        sublist.addField('tranid', 'text', 'Document No');
        sublist.addField('account', 'text', 'Account');
        sublist.addField('debit', 'currency', 'Debit');
        sublist.addField('credit', 'currency', 'Credit');
        sublist.addField('entity', 'text', 'Entity');
        sublist.addField('memo', 'text', 'Memo');

        var resultSet2 = nlapiCreateSearch('transaction', filters, [
            new nlobjSearchColumn('trandate'),
            new nlobjSearchColumn('type'),
            new nlobjSearchColumn('tranid'),
            new nlobjSearchColumn('account'),
            new nlobjSearchColumn('debitamount'),
            new nlobjSearchColumn('creditamount'),
            new nlobjSearchColumn('entity'),
            new nlobjSearchColumn('memo')
        ]).runSearch();

        var start = 0;
        var line = 1;
        var batchSize = 1000;

        do {
            var results = resultSet2.getResults(start, start + batchSize);
            if (!results || results.length === 0) break;

            for (var i = 0; i < results.length; i++) {
                var result = results[i];

                sublist.setLineItemValue('date', line, result.getValue('trandate'));
                sublist.setLineItemValue('type', line, result.getText('type'));
                sublist.setLineItemValue('tranid', line, result.getValue('tranid'));
                sublist.setLineItemValue('account', line, result.getText('account'));

                var debit = result.getValue('debitamount');
                var credit = result.getValue('creditamount');

                if (debit && debit !== '0.00') sublist.setLineItemValue('debit', line, debit);
                if (credit && credit !== '0.00') sublist.setLineItemValue('credit', line, credit);

                sublist.setLineItemValue('entity', line, result.getText('entity'));
                sublist.setLineItemValue('memo', line, result.getValue('memo'));

                line++;
                if (line > 1000) break;
            }

            start += batchSize;
            if (line > 1000) break;
        } while (true);
    }

    response.writePage(form);
}
