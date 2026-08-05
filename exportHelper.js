const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

const exportsDir = path.join(__dirname, 'exports');
if (!fs.existsSync(exportsDir)) {
    fs.mkdirSync(exportsDir);
}

/**
 * Exports scraped data to CSV, Excel, and JSON formats.
 * @param {Array<object>} data - The array of scraped company data.
 * @returns {Promise<object>} - An object with paths to the exported files.
 */
async function exportData(data) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileBase = `scrape-results-${timestamp}`;

    const records = data.map(d => ({
        companyName: d.name,
        website: d.websiteUrl,
        email: Array.isArray(d.emails) ? d.emails.join(', ') : '',
        phone: Array.isArray(d.phoneNumbers) ? d.phoneNumbers.join(', ') : '',
        services: Array.isArray(d.services) ? d.services.join(', ') : '',
        techStack: Array.isArray(d.technologies) ? d.technologies.join(', ') : '',
        socialLinks: d.socialLinks ? Object.entries(d.socialLinks).map(([k,v]) => `${k}: ${v}`).join(' | ') : '',
        address: d.address || '',
    }));

    const csvPath = await exportToCsv(records, fileBase);
    const excelPath = await exportToExcel(records, fileBase);
    const jsonPath = await exportToJson(data, fileBase);

    return {
        csv: path.basename(csvPath),
        excel: path.basename(excelPath),
        json: path.basename(jsonPath),
    };
}

async function exportToCsv(records, fileBase) {
    const filePath = path.join(exportsDir, `${fileBase}.csv`);
    const csvWriter = createCsvWriter({
        path: filePath,
        header: [
            { id: 'companyName', title: 'Company Name' },
            { id: 'website', title: 'Website' },
            { id: 'email', title: 'Email' },
            { id: 'phone', title: 'Phone' },
            { id: 'services', title: 'Services' },
            { id: 'techStack', title: 'Tech Stack' },
            { id: 'socialLinks', title: 'Social Links' },
            { id: 'address', title: 'Address' },
        ],
    });

    await csvWriter.writeRecords(records);
    return filePath;
}

async function exportToExcel(records, fileBase) {
    const filePath = path.join(exportsDir, `${fileBase}.xlsx`);
    const worksheet = xlsx.utils.json_to_sheet(records);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Results');
    xlsx.writeFile(workbook, filePath);
    return filePath;
}

async function exportToJson(data, fileBase) {
    const filePath = path.join(exportsDir, `${fileBase}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return filePath;
}

module.exports = { exportData };