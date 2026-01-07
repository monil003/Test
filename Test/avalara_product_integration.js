/**
 * @version v1.0.1
 */

            const productAttributeValue1 = itemRec.getValue('cost');
            const productAttributeValue2 = itemRec.getSublistValue({ sublistId: 'price1', fieldId: 'price_1_', line: 0 });
            const productAttributeValue3 = itemRec.getValue('custitem8');
            const tobaccoContentType = itemRec.getValue('custitem_tobacco_content_type');
            const tobaccoMarketing = itemRec.getValue('custitem_tobacco_marketing');
            const tobaccoRollType = itemRec.getValue('custitem_tobacco_roll_type');
            const tobaccoTipType = itemRec.getValue('custitem_tobacco_tip_type');
            const tobaccoWrapperType = itemRec.getValue('custitem_tobacco_wrapper_type');
            const tobaccoStorageType = itemRec.getValue('custitem_tobacco_storage_type');
            const tobaccoPackageType = itemRec.getValue('custitem_tobacco_package_type');
            const tobaccoStampedType = itemRec.getValue('custitem_tobacco_stamped_type');


            const isItemCategoryTobacco = isTobaccoCategory(itemCategoryId);
            const currentTimeStamp = getTimeStamp();


            //Alternate Product Integration
            if (!isItemCategoryTobacco) {
               const payload = {
                  CountryCode: params.custscript_country_code,
                  Jurisdiction: params.custscript_juridiction,
                  ProductCode: "TAXGOOD",
                  AlternateProductCode: itemName,
                  EffectiveDate: "2022-01-01T00:00:00.000Z",
                  ObsoleteDate: "2026-01-01T00:00:00.000Z",
                  TerminalCode: "*",
                  AlternativeFuelContent: displayName,
                  TaxCode: "",
                  Name: itemName + '_Alternate_Product_import_' + currentTimeStamp,
               }


                // -------------------------------
                // Make HTTPS POST call to Avalara
                // -------------------------------
                const headers = {
                    "Content-Type": "application/json",
                    "x-company-id": "1534",
                    "Authorization": "Basic bnNhcGl1c2VyOkFsdGFkaXN1c2E1OTAwIQ==",
                    "Accept": "application/json"
                };


                log.debug('payload', payload);


                const url = "https://excisesbx.avalara.com/api/v1/AlternateProducts/Create";


                const response = https.post({
                    url: url,
                    body: JSON.stringify(payload),
                    headers: headers
                });


                log.debug('response', response);


                if (response.code === 200) {
                    const resBody = JSON.parse(response.body);
                    
                    log.audit('Avalara Tobacco API Response', {
                      code: response.code,
                      body: resBody
                    });
                } else {
                    
                    if (response.code == 400 && response.body == 'A matching record already exists in the system.') {
                       const url = "https://excisesbx.avalara.com/api/v1/AlternateProducts/Update";


                       const updateResponse = https.post({
                          url: url,
                          body: JSON.stringify(payload),
                          headers: headers
                       });


                       log.debug('updateResponse', updateResponse);
                    } else {
                      log.audit('Avalara Alternate product Result failed', response.body);
                    }
                }


               return;
            }


            // -------------------------------
            // Build Payload
            // -------------------------------
            const payload = {
                TobaccoProducts: [
                    {
                        CountryCode: params.custscript_country_code,
                        Jurisdiction: params.custscript_juridiction,
                        Upc: upcCode,
                        Name: displayName,
                        ProductCode: "CIGAR",
                        CustomId: itemName ? itemName : customId,
                        EffectiveDate: params.custscript_effective_date,
                        ObsoleteDate: "",
                        LockedDate: "",
                        BrandCode: "",
                        Style: "",
                        UnitOfMeasure: "PAK",
                        UnitsPerPackage: unitCapacity,
                        Description: brandDesc,
                        ModifiedRiskType: "",
                        ModifiedRiskNumber: "",
                        UnitVolume: 0,
                        UnitWeight: 0,
                        UnitVolumeUnitOfMeasure: "",
                        UnitWeightUnitOfMeasure: "",