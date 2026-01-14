/**
 * @version v1.0.1
 */

/**
 * @NScriptType Suitelet
 */
function suitelet(request, response) {
    var form = nlapiCreateForm('Last 12 Months Debit & Credit Report');

    var drillAccountId = request.getParameter('accountid');

    function getOneYearAgoDate() {
        var d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return nlapiDateToString(d);
    }

    if (drillAccountId) {
        // ===== SUBACCOUNT REPORT =====
        form.setTitle('Subaccount Report');
        form.addButton('custpage_back', 'Back', 'window.location.href="' +
            nlapiResolveURL('SUITELET', 'customscript_tc_credit_debit_report', 'customdeploy_tc_credit_debit_report') + '"');

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

        var start = 0;
        var batchSize = 1000;
        var line = 1;
        var results;

        do {
            results = resultSet.getResults(start, start + batchSize > start + 1000 ? start + 1000 : start + batchSize);
            if (!results || results.length === 0) break;

            for (var i = 0; i < results.length; i++) {
                var r = results[i];

                sublist.setLineItemValue('date', line, r.getValue('trandate'));
                sublist.setLineItemValue('type', line, r.getText('type'));
                sublist.setLineItemValue('tranid', line, r.getValue('tranid'));
                sublist.setLineItemValue('subaccount', line, r.getText('account'));

                var debit = r.getValue('debitamount');
                var credit = r.getValue('creditamount');

                if (debit && debit !== '0.00') sublist.setLineItemValue('debit', line, debit);
                if (credit && credit !== '0.00') sublist.setLineItemValue('credit', line, credit);

                sublist.setLineItemValue('entity', line, r.getText('entity'));
                sublist.setLineItemValue('memo', line, r.getValue('memo'));

                line++;
                if (line > 1000) break;
            }

            if (results.length < batchSize) break;

            start += batchSize;
            if (line > 1000) break;
        } while (results && results.length > 0);

    } else {
        // ===== MAIN REPORT =====
        form.setTitle('Last 12 Months Debit & Credit Report');

        // === GET UNIQUE ACCOUNTS ===
        var accountFilters = [
            new nlobjSearchFilter('posting', null, 'is', 'T'),
            new nlobjSearchFilter('trandate', null, 'onorafter', getOneYearAgoDate())
        ];

        var accountColumns = [new nlobjSearchColumn('account')];

        var accountSearch = nlapiCreateSearch('transaction', accountFilters, accountColumns);
        var accountResultSet = accountSearch.runSearch();

        var startAccounts = 0;
        var batchSize = 1000;
        var accountResults;
        var accountMap = {};

        do {
            accountResults = accountResultSet.getResults(startAccounts, startAccounts + batchSize);
            if (!accountResults || accountResults.length === 0) break;

            for (var i = 0; i < accountResults.length; i++) {
                var accId = accountResults[i].getValue('account');
                var accName = accountResults[i].getText('account');
                if (!accountMap[accId]) accountMap[accId] = accName;
            }

            startAccounts += batchSize;
        } while (accountResults && accountResults.length > 0);

        // Add dropdown
        var accountSelect = form.addField('custpage_account_filter', 'select', 'Drill Down by Account');
        accountSelect.addSelectOption('', 'Select an account');
        for (var id in accountMap) accountSelect.addSelectOption(id, accountMap[id]);

        form.addSubmitButton('View Subaccounts');

        // === MAIN TRANSACTION SUBLIST ===
        var sublist = form.addSubList('custpage_report', 'list', 'Report');
        sublist.addField('date', 'date', 'Date');
        sublist.addField('type', 'text', 'Type');
        sublist.addField('tranid', 'text', 'Document No');
        sublist.addField('account', 'text', 'Account');
        sublist.addField('debit', 'currency', 'Debit');
        sublist.addField('credit', 'currency', 'Credit');
        sublist.addField('entity', 'text', 'Entity');
        sublist.addField('memo', 'text', 'Memo');

        // Fetch transactions
        var transactionSearch = nlapiCreateSearch('transaction', accountFilters, [
            new nlobjSearchColumn('trandate'),
            new nlobjSearchColumn('type'),
            new nlobjSearchColumn('tranid'),
            new nlobjSearchColumn('account'),
            new nlobjSearchColumn('debitamount'),
            new nlobjSearchColumn('creditamount'),
            new nlobjSearchColumn('entity'),
            new nlobjSearchColumn('memo')
        ]);
        var transactionResultSet = transactionSearch.runSearch();

        var startTrans = 0;
        var line = 1;
        var transResults;

        do {
            transResults = transactionResultSet.getResults(startTrans, startTrans + batchSize);
            if (!transResults || transResults.length === 0) break;

            for (var i = 0; i < transResults.length; i++) {
                var r = transResults[i];

                sublist.setLineItemValue('date', line, r.getValue('trandate'));
                sublist.setLineItemValue('type', line, r.getText('type'));
                sublist.setLineItemValue('tranid', line, r.getValue('tranid'));
                sublist.setLineItemValue('account', line, r.getText('account'));

                var debit = r.getValue('debitamount');
                var credit = r.getValue('creditamount');

                if (debit && debit !== '0.00') sublist.setLineItemValue('debit', line, debit);
                if (credit && credit !== '0.00') sublist.setLineItemValue('credit', line, credit);

                sublist.setLineItemValue('entity', line, r.getText('entity'));
                sublist.setLineItemValue('memo', line, r.getValue('memo'));

                line++;
                if (line > 1000) break;
            }

            startTrans += batchSize;
            if (line > 1000) break;
        } while (transResults && transResults.length > 0);
    }

    response.writePage(form);
}
