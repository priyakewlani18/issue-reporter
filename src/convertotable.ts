/**
 * Generate markdown table from an array of objects
 *
 * @param  {Array} array    Array of objects
 * @param  {Array} columns  Optional, table column names, otherwise taken from the keys of the first object
 * @param  {String} alignment Optional table alignment. Can be 'center' (default), 'left' or 'right'
 *
 * @return {String} Markdown table
 */
 export function* arrayToTable (array:any, columns = '', alignment = 'center') {
    var table = ""
    var separator = {
      'left': ':---',
      'right': '---:',
      'center': '---'
    }
  
    // Generate column list
    var cols = Object.keys(array[0])
  
    // Generate table headers
    table += cols.join(" | ")
    table += "\r\n"
  
    // Generate table header seperator
    table += cols.map(function () {
      return '---'
    }).join(' | ')
    table += "\r\n"
  
    // Generate table body
    array.forEach(function (item:any) {
      table += cols.map(function (key:any) {
        return String(item[key] || "")
      }).join(" | ") + "\r\n"
    })
  
    // Return table
    console.log(table)
    return table
  }