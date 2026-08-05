"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateExcelFile = generateExcelFile;
const XLSX = __importStar(require("xlsx"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
function generateExcelFile(results, outputFolder) {
    if (!fs_1.default.existsSync(outputFolder)) {
        fs_1.default.mkdirSync(outputFolder, { recursive: true });
    }
    const timestamp = Date.now();
    const fileName = `scraped_companies_${timestamp}.xlsx`;
    const filePath = path_1.default.join(outputFolder, fileName);
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
        { wch: 6 }, // S.No
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
