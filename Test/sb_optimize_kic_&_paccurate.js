/**
 * @version v1.0.1
 */



    // ---------- KeepItCool integration (uses saved search to build shipments) ----------
    function processKeepItCoolIntegration(context) {
        try {
            if (context.type !== context.UserEventType.CREATE &&
                context.type !== context.UserEventType.EDIT) {
                return;
            }


            const soId = context.newRecord.id;
            log.debug('soId', soId)
            // ---- Build payload using saved search ----
            const salesorderSearchObj = search.create({
                type: "salesorder",
                settings: [{ name: "consolidationtype", value: "ACCTTYPE" }],
                filters: [
                    ["type", "anyof", "SalesOrd"],
                    "AND",
                    ["internalid", "anyof", soId],
                    "AND",
                    ["mainline", "is", "F"],
                    "AND",
                    ["taxline", "is", "F"],
                    "AND",
                    ["shipping", "is", "F"],
                    "AND",
                    ["item.type", "anyof", "InvtPart"],
                    "AND",
                    ["item.custitem_ollie_frozen_item", "is", "T"]
                ],
                columns: [
                    search.createColumn({ name: "tranid" }),
                    search.createColumn({ name: "shipzip" }),
                    search.createColumn({ name: "shipdate" }),
                    search.createColumn({ name: "quantity" }),
                    search.createColumn({ name: "shipmethod" }),
                    search.createColumn({ name: "custbody_mhi_op_planshipdate" }),
                    search.createColumn({ name: "custbody_mhi_op_daysintransit" }),
                    search.createColumn({
                        name: "formulatext",
                        formula: "LTRIM(SUBSTR({item}, INSTR({item}, ':') + 1))"
                    })
                ]
            });
            log.debug('salesorderSearchObj', salesorderSearchObj)
            var searchResultCount = salesorderSearchObj.runPaged().count;
            log.debug('searchResultCount', searchResultCount)


            let shipments = [];


            salesorderSearchObj.run().each(result => {
                let orderNum = result.getValue("tranid") || "";
                if (orderNum) orderNum = String(orderNum).split('.')[0];


                const shipZip = result.getValue("shipzip") || "";
                const shipDateValue = result.getValue("custbody_mhi_op_planshipdate");


                const planShipDate = result.getValue("custbody_mhi_op_planshipdate");
                const daysInTransit = result.getValue("custbody_mhi_op_daysintransit") || 0;


                let shipDate = "";
                if (shipDateValue) {
                    const dateObj = new Date(shipDateValue);
                    const year = dateObj.getFullYear();
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    shipDate = `${year}-${month}-${day}`;
                }


                var expectedShipDate = '';


                if (planShipDate) {
                    var planDateObj = new Date(planShipDate);
                    const daysToAdd = parseInt(daysInTransit, 10) || 0;

