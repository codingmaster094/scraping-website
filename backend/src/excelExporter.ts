import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { ScrapeResult } from "./scraper";

export function generateExcelFile(
  results: ScrapeResult[],
  outputFolder: string
): { fileName: string; filePath: string } {
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }

  const timestamp = Date.now();
  const fileName = `scraped_companies_${timestamp}.xlsx`;
  const filePath = path.join(outputFolder, fileName);

  const formattedRows = results.map((item, index) => ({
    "S.No": index + 1,
    "Company Name": item.companyName || "N/A",
    "Company Website": item.companyUrl || "N/A",
    "Email": item.companyEmail || "N/A",
    "Phone Number": item.companyPhone || "N/A",
    "Services / Description": item.service || "N/A",
    "Technologies Stack": Array.isArray(item.technologies)
      ? item.technologies.join(", ")
      : "N/A",
    "Address": item.address || "N/A",
    "Rating": item.rating || "N/A",
  }));

  const worksheet = XLSX.utils.json_to_sheet(formattedRows);

  worksheet["!cols"] = [
    { wch: 6 },  // S.No
    { wch: 32 }, // Company Name
    { wch: 45 }, // Company Website
    { wch: 32 }, // Email
    { wch: 22 }, // Phone Number
    { wch: 55 }, // Services
    { wch: 38 }, // Technologies
    { wch: 40 }, // Address
    { wch: 12 }, // Rating
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Companies");

  XLSX.writeFile(workbook, filePath);

  return { fileName, filePath };
}
