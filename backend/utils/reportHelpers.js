const { DEFAULT_REPORT_STATUS } = require('../config/constants');
const { extractUserProfile } = require('./userProfile');

const buildReportResponse = (report, { includeReporterContact = false } = {}) => {
    const response = {
        ...report,
        status: report.status || DEFAULT_REPORT_STATUS,
        description: report.description || '',
        image_url: report.image_url || null,
        image_drive_id: report.image_drive_id || null,
        position: {
            lat: parseFloat(report.lat),
            lng: parseFloat(report.lng)
        }
    };

    if (includeReporterContact) {
        const reporterProfile = extractUserProfile(report.users);
        response.reporterName = reporterProfile.name;
        response.reporterEmail = reporterProfile.email;
    }

    return response;
};

module.exports = {
    buildReportResponse,
};
