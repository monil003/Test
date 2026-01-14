/**
 * @version v1.0.1
 */

/**
 * @NScriptType Suitelet
 */

function suitelet(request, response) {

    if (request.getMethod() === 'GET') {

        var form = nlapiCreateForm('Last 12 Months Debit & Credit Report');

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

                sublist.setLineItemValue('date', line, result.getValue('trandate'));
                sublist.setLineItemValue('type', line, result.getText('type'));
                sublist.setLineItemValue('tranid', line, result.getValue('tranid'));
                sublist.setLineItemValue('account', line, result.getText('account'));

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
}
