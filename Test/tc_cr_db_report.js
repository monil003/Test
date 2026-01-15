/**
 * @version v1.0.1
 */

/**
 * @NScriptType Suitelet
 */
function suitelet(request, response) {

    if (request.getMethod() === 'GET') {

        // 1. Create Report Form
        var form = nlapiCreateReportForm('Last 12 Months Debit & Credit (Pivot)');

        // 2. Create Report Definition
        var reportDef = nlapiCreateReportDefinition();
        reportDef.setRecordType('transaction');

        // 3. Filters
        reportDef.addFilter(
            new nlobjSearchFilter('posting', null, 'is', 'T')
        );

        reportDef.addFilter(
            new nlobjSearchFilter(
                'trandate',
                null,
                'onorafter',
                getOneYearAgoDate()
            )
        );

        // 4. Pivot Table
        var pivot = new nlobjPivotTable();

        // ---- Rows (Account)
        pivot.addRow(
            new nlobjPivotRow('account')
        );

        // ---- Columns (Month)
        pivot.addColumn(
            new nlobjPivotColumn('trandate', 'month')
        );

        // ---- Measures
        pivot.addMeasure(
            new nlobjPivotMeasure('debitamount', 'sum', 'Total Debit')
        );

        pivot.addMeasure(
            new nlobjPivotMeasure('creditamount', 'sum', 'Total Credit')
        );

        // 5. Attach pivot to report definition
        reportDef.setPivotTable(pivot);

        // 6. Attach report to form
        form.setReportDefinition(reportDef);

        // 7. Render
        response.writePage(form);
    }
}

/**
 * Returns date string (M/d/yyyy) one year ago
 */
function getOneYearAgoDate() {
    var d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    return nlapiDateToString(d);
}
