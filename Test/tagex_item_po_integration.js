/**
 * @version v1.0.1
 */

/**
* @NApiVersion 2.1
* @NScriptType Restlet
*/
define(['N/record', 'N/log', 'N/search', 'N/file', 'N/runtime'], (record, log, search, file, runtime) => {
  
  const post = (requestBody) => {
    try {
      
      let params = getScriptParams();
      log.debug('Incoming Default Params', params);
      const inventoryAccount = params.inventoryAccount ? params.inventoryAccount : 760;
      const assetAccount = params.assetAccount ? params.assetAccount : 220;
      const cogsAccount = params.cogsAccount ? params.cogsAccount : 772;
      const PO_LINE_CLASS = 13; //shopify
      
      var externalId = requestBody.externalid;
      if (!externalId) {
        return {
          statusCode: 400,
          message: 'Missing required field: externalid'
        };
      }
      
      // helper function to apply fields dynamically
      function applyFields(rec, data, skipFields = []) {
        for (let key in data) {
          if (!data.hasOwnProperty(key)) continue;
          if (skipFields.includes(key)) continue;
          
          let value = data[key];
          if (value !== undefined && value !== null && value !== '') {
            try {
              rec.setValue({ fieldId: key, value: value });
            } catch (err) {
              log.debug(`Skipped field ${key}`, err.message);
            }
          }
        }
      }
      
      if (requestBody.recordType === 'inventoryitem') {
        // Search for existing record with the same externalid
        var existingId = findItemByExternalId(externalId);
        
        var rec;
        let actionPerform;
        
        if (existingId) {
          rec = record.load({
            type: record.Type.INVENTORY_ITEM,
            id: existingId,
            isDynamic: true
          });
          actionPerform = 'updated';
        } else {
          rec = record.create({
            type: record.Type.INVENTORY_ITEM,
            isDynamic: true
          });
          rec.setValue({ fieldId: 'externalid', value: requestBody.externalid });
          actionPerform = 'created';
        }
        
        requestBody.hierarchy_version = Number(params.hierarchyversion);
        requestBody.isincluded = params.isincluded;
        requestBody.taxschedule = Number(params.taxschedule);
        requestBody.offersupport = params.offersupport;

        if (requestBody.displayname) {
          requestBody.salesdescription = requestBody.displayname;
          requestBody.purchasedescription = requestBody.displayname;
        } else if (requestBody.purchasedescription) {
          requestBody.salesdescription = requestBody.purchasedescription;
          requestBody.displayname = requestBody.purchasedescription;
        } else if (requestBody.salesdescription) {
          requestBody.purchasedescription = requestBody.salesdescription;
          requestBody.displayname = requestBody.salesdescription;
        }
         
        log.debug('Incoming POST Data', requestBody);
        
        if (requestBody.custitem_ns_tx_client) {
          let customerId = findCustomerIdByName(requestBody.custitem_ns_tx_client);
          let vendorId = findVendorIdByName(requestBody.custitem_ns_tx_client);

          if (vendorId) {
            log.debug(`Vendor found for name ${requestBody.custitem_ns_tx_client}`);
            setPreferredVendor(rec, vendorId)
          }

          if (customerId) {
            requestBody.custitem_ns_tx_client = customerId;
          } else {
            requestBody.custitem_ns_tx_client = '';
            log.debug(`No entity (customer) found for name ${requestBody.custitem_ns_tx_client}`);
            // return {
            //   statusCode: 400,
            //   status: 'error',
            //   message: `No entity (customer) found for name ${requestBody.custitem_ns_tx_client}`
            // };
          }
        } else {
          requestBody.custitem_ns_tx_client = '';
          log.debug(`No entity (customer/vendor) found for name ${requestBody.custitem_ns_tx_client}`);
          // return {
          //   statusCode: 400,
          //   status: 'error',
          //   message: 'No entity found'
          // };
        }

        // Apply fields dynamically, skip special ones
        applyFields(rec, requestBody, ['recordType', 'externalid', 'items']);

        let nodeId = findHierarchyNodeIdByName(requestBody.hierarchy_node);

        if (requestBody.hierarchy_node) {
          let nodeText = getHierarchyString(requestBody.hierarchy_node);

          requestBody.custitem_hierarchy_node_shopify = nodeText ? nodeText : "";
        }

        log.debug('nodeId', nodeId);
        if (!nodeId) {
          log.debug(`Hierarchy Node "${requestBody.hierarchy_node}" not found in NetSuite`);
          // throw new Error(`Hierarchy Node "${requestBody.hierarchy_node}" not found in NetSuite`);
        }

        var lineNumber = rec.findSublistLineWithValue({
          sublistId: 'hierarchyversions',
          fieldId: 'hierarchyversion',
          value: Number(params.hierarchyversion)
        });
      
      if (lineNumber !== -1) {
          rec.selectLine({ sublistId: 'hierarchyversions', line: lineNumber });
          
          // log.debug('requestBody.hierarchy_node', requestBody.hierarchy_node);
          rec.setCurrentSublistValue({
              sublistId: 'hierarchyversions',
              fieldId: 'hierarchynode',
              value: parseInt(nodeId)
          });

          rec.setCurrentSublistValue({
              sublistId: 'hierarchyversions',
              fieldId: 'isincluded',
              value: requestBody.isincluded
          });
          
          rec.commitLine({ sublistId: 'hierarchyversions' });
      }

        log.debug('requestBody', requestBody);

        if (assetAccount) {
          rec.setValue({ fieldId: 'assetaccount', value: assetAccount });
        }

        if (inventoryAccount) {
          rec.setValue({ fieldId: 'incomeaccount', value: inventoryAccount });
        }

        if (cogsAccount) {
          rec.setValue({ fieldId: 'cogsaccount', value: cogsAccount });
        }
        
        // Save record
        let itemId = rec.save({ ignoreMandatoryFields: true });
        log.debug('itemId', itemId);
        
        // directly take it from the request body
        var subItemDataList = requestBody.sub_item_view || [];
        
        // Save file with multiple rows + dynamic headers
        var fileId = createSubItemExcelFile(itemId, subItemDataList, 'custitem_sub_item_excel_file', '330127');
        
        log.debug("fileId", fileId);
        
        return {
          statusCode: 201,
          status: 'success',
          id: itemId,
          ItemName: requestBody.displayname,
          Message: "Inventory Item record " + actionPerform + " successfully!"
        };
        
      } 
      else if (requestBody.recordType === 'purchaseorder') {
        var existingId = findPOByExternalId(externalId);
        
        var rec;
        let actionPerform;
        
        if (existingId) {
          rec = record.load({
            type: 'purchaseorder',
            id: existingId,
            isDynamic: true
          });
          actionPerform = 'updated';
        } else {
          rec = record.create({
            type: 'purchaseorder',
            isDynamic: true
          });
          rec.setValue({ fieldId: 'externalid', value: requestBody.externalid });
          actionPerform = 'created';
        }
        
        requestBody.custbody_po_type = params.custbody_po_type;
        requestBody.department = params.po_department;
        requestBody.terms = params.terms;
        
        log.debug('Incoming POST Data', requestBody);

        if (requestBody.entity) {
          let vendorId = findVendorIdByName(requestBody.entity);

          if (vendorId) {
            requestBody.entity = vendorId;
          } else {
            log.debug('No entity (Vendor) found', requestBody.entity);
            return {
              statusCode: 400,
              status: 'error',
              message: `No entity (Vendor) found for name ${requestBody.entity}`
            };
          }
        } else {
          log.debug('No entity (Vendor) found', requestBody.entity);
          return {
            statusCode: 400,
            status: 'error',
            message: `No entity (Vendor) found for name ${requestBody.entity}`
          };
        }

        if (requestBody.location) {
          let locationId;

          try {
            locationId = findLocationIdByNameForPO(requestBody.location);
          } catch (error) {
            log.debug('location setup error');
            locationId = findLocationIdByName(requestBody.location);
          }

          if (locationId) {
            requestBody.location = locationId;
          } else {
            log.debug('No location found for name', requestBody.location);
            return {
              statusCode: 400,
              status: 'error',
              message: `No location found for name ${requestBody.location}`
            };
          }
        } else {
          log.debug('No location found for name', requestBody.location);
          return {
            statusCode: 400,
            status: 'error',
            message: `No location found for name ${requestBody.location}`
          };
        }
        
        // Apply fields dynamically, skip special ones
        applyFields(rec, requestBody, ['recordType', 'externalid', 'items']);
        
        rec.setValue({ fieldId: 'trandate', value: new Date() });
                      log.debug('Header.department',params.department)

        rec.setValue({ fieldId: 'department', value: params.department });
        rec.setValue({ fieldId: 'class', value: PO_LINE_CLASS });
        
        // Items sublist handling
        if (requestBody.items && requestBody.items.length > 0) {
          log.debug('items: ', requestBody.items);
          
          for (let i = 0; i < requestBody.items.length; i++) {
            let line = requestBody.items[i];
            
            rec.selectNewLine({ sublistId: 'item' });
            
            rec.setCurrentSublistValue({
              sublistId: 'item',
              fieldId: 'item',
              value: line.item
            });
            
            if (line.quantity !== undefined) {
              rec.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'quantity',
                value: line.quantity
              });
            }
            
            if (line.description) {
              rec.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'description',
                value: line.description
              });
            }
            
              rec.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'department',
                value: params.department
              });

            if (PO_LINE_CLASS) {
              rec.setCurrentSublistValue({
                sublistId: 'item',
                fieldId: 'class',
                value: PO_LINE_CLASS
              });
            }
            
            
            rec.commitLine({ sublistId: 'item' });
          }
        }
        
        // Save record
        let PO_record = rec.save({ ignoreMandatoryFields: true });
        log.debug('PO_record', PO_record);
        
        return {
          statusCode: 201,
          status: 'success',
          id: PO_record,
          Message: 'PO record ' + actionPerform + ' successfully'
        };
        
      } else {
        return {
          statusCode: 400,
          status: 'error',
          message: 'Please provide valid record type (recordType)'
        };
      }
      
    } catch (e) {
      log.error('Error in post function', e);
      return { statusCode: 500, status: 'error', message: e.message };
    }
  };
  
  function findItemByExternalId(externalId) {
    var searchResult = search.create({
      type: search.Type.INVENTORY_ITEM,
      filters: [['externalidstring', 'is', externalId]],
      columns: ['internalid']
    }).run().getRange({ start: 0, end: 1 });
    
    log.debug('searchResult: ', searchResult)
    
    return (searchResult && searchResult.length > 0)
    ? searchResult[0].getValue('internalid')
    : null;
  }

  function findCustomerIdByName(customerName) {
    var customerId;
    search.create({
      type: 'customer',
      filters: [['entityid', 'contains', customerName]],
      columns: ['internalid']
    }).run().each(function (result) {
      customerId = result.getValue('internalid');
      return false;
    });
    return customerId;
  }

  function findVendorIdByName(vendorName) {
    var vendorId;

    log.debug('vendorName', vendorName);
    try {
      search.create({
        type: 'vendor',
        filters: [['entityid', 'haskeywords', vendorName]],
        columns: ['internalid']
      }).run().each(function (result) {
        vendorId = result.getValue('internalid');
        return false;
      });
    } catch (error) {
      log.debug('error in vendor search, use another approach')
      search.create({
        type: 'vendor',
        filters: [['entityid', 'equalto', vendorName]],
        columns: ['internalid']
      }).run().each(function (result) {
        vendorId = result.getValue('internalid');
        return false;
      });
    }
    log.debug('vendorId', vendorId)
    return vendorId;
  }
  
  function findPOByExternalId(externalId) {
    var poSearch = search.create({
      type: 'purchaseorder',
      filters: [
        ['externalidstring', 'is', externalId]
      ],
      columns: ['internalid']
    }).run().getRange({ start: 0, end: 1 });
    
    return (poSearch && poSearch.length > 0)
    ? poSearch[0].getValue('internalid')
    : null;
  }

  function getChildNode(str) {
    if (!str) return "";
  
    const parts = str.split(":");
    return parts[parts.length - 1].trim();
  }
  
  function findHierarchyNodeIdByName(nodeName) {
    let childNodeIs = getChildNode(nodeName);
    var nodeId;
    search.create({
      type: 'merchandisehierarchynode',
      filters: [['name', 'is', childNodeIs]],
      columns: ['internalid']
    }).run().each(function (result) {
      nodeId = result.getValue('internalid');
      return false; // stop after first match
    });
    return nodeId;
  }

  // function findLocationIdByName(locationName) {
  //   var locationId;
  //   search.create({
  //     type: 'location',
  //     filters: [['name', 'contains', locationName]],
  //     columns: ['internalid']
  //   }).run().each(function (result) {
  //     locationId = result.getValue('internalid');
  //     return false; // stop after first match
  //   });
  //   return locationId;
  // }
  function findLocationIdByName(locationName) {
    var upperName = locationName.toUpperCase();
    var isConsCase = upperName.includes('CONS');
    
    var filters;
    
    if (isConsCase) {
       filters = [
          ["name", "contains", locationName]
       ];
    } else {
      filters = [
         ["name", "doesnotstartwith", 'East Region : CONS'],
          "AND",
         ["name", "contains", locationName]
      ];
    }
    
    var id = null;
    
    search.create({
      type: "location",
      filters: filters,
      columns: ["internalid", "name"]
    }).run().each(function (result) {
        id = result.getValue("internalid");
        return false; // return first match
    });
    
    return id;
  }
  
  function getScriptParams() {
    let script = runtime.getCurrentScript();
    
    // Collect multiple script parameters
    return {
      department: script.getParameter({ name: 'custscript_item_department_' }),
      po_department: script.getParameter({ name: 'custscript_po_department_' }),
      custbody_po_type: script.getParameter({ name: 'custscript_po_type_' }),
      terms: script.getParameter({ name: 'custscript_terms_' }),
      hierarchyversion: script.getParameter({ name: 'custscript_hierarchy_version_' }),
      isincluded: script.getParameter({ name: 'custscript_hierarchy_included_version' }),
      atpmethod: script.getParameter({ name: 'custscript_default_atp_method_' }),
      offersupport: script.getParameter({ name: 'custscript_offer_support_' }),
      taxschedule: script.getParameter({ name: 'custscript_tax_schedule_' }),
      inventoryAccount: script.getParameter({ name: 'custscript_inventory_account' }),
      assetAccount: script.getParameter({ name: 'custscript_asset_account' }),
      cogsAccount: script.getParameter({ name: 'custscript_cogs_account' }),
    };
  }
  
  function createSubItemExcelFile(itemId, subItemDataList, fileFieldId, folderId) {
    try {
      if (!subItemDataList || subItemDataList.length === 0) {
        log.debug('No Sub Item Data provided, skipping file creation');
        return null;
      }
      
      // 1. Collect all unique keys across all objects (for dynamic fields)
      var headersSet = {};
      subItemDataList.forEach(function (obj) {
        Object.keys(obj).forEach(function (key) {
          headersSet[key] = true;
        });
      });
      var headers = Object.keys(headersSet);
      
      // 2. Build CSV rows
      var rows = [];
      subItemDataList.forEach(function (obj) {
        var row = headers.map(function (h) {
          return (obj[h] !== undefined && obj[h] !== null) ? obj[h] : '';
        });
        rows.push(row.join(','));
      });
      
      // 3. Build final CSV string
      var csvContent = headers.join(',') + '\n' + rows.join('\n');
      
      // 4. Create file in File Cabinet
      var csvFile = file.create({
        name: 'SubItemView_' + itemId + '.csv',
        fileType: file.Type.CSV,
        contents: csvContent,
        folder: folderId
      });
      
      var fileId = csvFile.save();
      
      // 5. Attach file to item
      record.submitFields({
        type: record.Type.INVENTORY_ITEM,
        id: itemId,
        values: {
          [fileFieldId]: fileId
        }
      });
      
      return fileId;
    } catch (e) {
      log.error('Error creating sub-item Excel file', e);
      return null;
    }
  }

  function getHierarchyString(str) {
    if (!str) return "";

    const parts = str.split(':').map(s => s.trim());

    if (parts.length <= 1) {
        return "";
    }

    const result = parts.slice(1).join(' : ');

    return result;
  }

  function setPreferredVendor(rec, vendorId) {
    var count = rec.getLineCount({ sublistId: "itemvendor" });
  
    // Remove all preferred flags
    for (var i = 0; i < count; i++) {
      rec.selectLine({ sublistId: "itemvendor", line: i });
      rec.setCurrentSublistValue({
        sublistId: "itemvendor",
        fieldId: "preferredvendor",
        value: false
      });
      rec.commitLine({ sublistId: "itemvendor" });
    }
  
    var found = false;
  
    // Try to find existing vendor line
    for (var i = 0; i < count; i++) {
      var vId = rec.getSublistValue({
        sublistId: "itemvendor",
        fieldId: "vendor",
        line: i
      });
  
      if (vId == vendorId) {
        rec.selectLine({ sublistId: "itemvendor", line: i });
        rec.setCurrentSublistValue({
          sublistId: "itemvendor",
          fieldId: "preferredvendor",
          value: true
        });
        rec.commitLine({ sublistId: "itemvendor" });
        found = true;
        break;
      }
    }
  
    // Add a new vendor line if not found
    if (!found) {
      rec.selectNewLine({ sublistId: "itemvendor" });
      rec.setCurrentSublistValue({
        sublistId: "itemvendor",
        fieldId: "vendor",
        value: vendorId
      });
      rec.setCurrentSublistValue({
        sublistId: "itemvendor",
        fieldId: "preferredvendor",
        value: true
      });
      rec.commitLine({ sublistId: "itemvendor" });
    }
  }

  function findLocationIdByNameForPO(locationName) {
        var upperName = locationName.toUpperCase();
        var isConsCase = upperName.includes('CONS');
        const cleanedInput = locationName.replace(/_/g, ' ').trim().toLowerCase();

        var filters;

        if (isConsCase) {
            filters = [
                ["name", "contains", locationName]
            ];
        } else {
            filters = [
                ["name", "doesnotstartwith", 'East Region : CONS'],
                "AND",
                ["name", "contains", locationName]
            ];
        }

        var id = null;
        let locations = [];
        let bestMatch = { score: -1, id: null };

        search.create({
            type: "location",
            filters: filters,
            columns: [
                "internalid",
                "name",
                search.createColumn({
                    name: "formulatext",
                    formula: "{namenohierarchy}",
                    label: "LocationChild"
                })
            ]
        }).run().each(function (result) {
            id = result.getValue("internalid");
            const name = result.getValue("name");
            const childName = result.getValue({
                name: "formulatext",
                formula: "{namenohierarchy}"
            });

            const childLower = childName.toLowerCase();
            let score = 0;

            if (childLower === cleanedInput) {
                score = 3; // exact match
            } else if (childLower.startsWith(cleanedInput)) {
                score = 2; // starts with
            } else if (childLower.includes(cleanedInput)) {
                score = 1; // contains
            }

            if (score > bestMatch.score) {
                bestMatch = { score: score, id: id };
            }

            return true;
        });

        try {
           if (bestMatch.id) {
             return bestMatch.id
           } else {
             return id;
           }  
        } catch (error) {
          return id;
        }

    }
  
  return { post };
});
