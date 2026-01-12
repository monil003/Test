/**
 * @version v1.0.1
 */

        } catch (e) {
            // avoid blocking UI
            log.error('Custom Summary error', e);
        }
    }


    function money(n) {
        // simple formatting (keeps it safe for all locales)
        const x = Number(n || 0);
        const sign = x < 0 ? '-' : '';
        const v = Math.abs(x).toFixed(2);
        return sign + '$' + v.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }


    function buildSummaryHtml(t) {
        return `
        <table class="totallingtable" cellspacing="2" cellpadding="0" border="0" style="font-family:Arial, sans-serif; width:300px; border-collapse:collapse; margin-top:10px;">
          <caption style="display:none;">Custom Summary</caption>
          <tbody>
            <tr class="totallingtable_item uir-field-wrapper-cell">
              <td>
                <div class="uir-field-wrapper" data-field-name="subtotal">
                  <span class="smalltextnolink uir-label" style="font-size:10pt;">SUBTOTAL</span>
                  <span class="uir-field inputreadonly" style="float:right;">${money(t.itemsSubtotal)}</span>
                </div>
              </td>
            </tr>
    
            <tr class="totallingtable_item uir-field-wrapper-cell">
              <td>
                <div class="uir-field-wrapper" data-field-name="discounttotal">
                  <span class="smalltextnolink uir-label" style="font-size:10pt;">DISCOUNT ITEM</span>
                  <span class="uir-field inputreadonly" style="float:right;">${money(t.discountTotal)}</span>
                </div>
              </td>
            </tr>
    
            <tr class="totallingtable_item uir-field-wrapper-cell">
              <td>
                <div class="uir-field-wrapper" data-field-name="taxtotal">
                  <span class="smalltextnolink uir-label" style="font-size:10pt;">TAX TOTAL</span>
                  <span class="uir-field inputreadonly" style="float:right;">${money(t.taxTotal)}</span>
                </div>
              </td>
            </tr>
    
            <tr class="totallingtable_item uir-field-wrapper-cell">
              <td>
                <div class="uir-field-wrapper" data-field-name="altshippingcost">
                  <span class="smalltextnolink uir-label" style="font-size:10pt;">
                    Shipping Cost
                  </span>
                  <span class="uir-field inputreadonly" style="float:right;">
                    ${t.shippingTotal ? money(t.shippingTotal) : ''}
                  </span>
                </div>
              </td>
            </tr>
    
            <tr>
              <td colspan="2" class="uir-totallingtable-seperator">
                <div style="border-bottom:1px solid #000; width:100%; font-size:0;"></div>
              </td>
            </tr>
    
            <tr class="totallingtable_total uir-field-wrapper-cell">
              <td>
                <div class="uir-field-wrapper" data-field-name="total">
                  <span class="smalltextnolink uir-label" style="font-weight:700; font-size:10pt;">Total</span>
                  <span class="uir-field inputreadonly" style="float:right; font-weight:700;">${money(t.grandTotal)}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        `;
    }


    return { beforeLoad };
});

