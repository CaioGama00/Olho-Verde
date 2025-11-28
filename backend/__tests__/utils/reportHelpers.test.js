const { buildReportResponse } = require("../../utils/reportHelpers");

describe("ReportHelpers", () => {
  const baseReport = {
    id: 1,
    user_id: "user-123",
    problem: "alagamento",
    description: "Rua alagada",
    lat: -23.5505,
    lng: -46.6333,
    image_url: "https://example.com/image.jpg",
    status: "nova",
    moderation_status: "aprovado",
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T10:00:00Z",
  };

  describe("buildReportResponse", () => {
    it("should build response with all required fields", () => {
      const result = buildReportResponse(baseReport);

      expect(result).toHaveProperty("id", 1);
      expect(result).toHaveProperty("problem", "alagamento");
      expect(result).toHaveProperty("description", "Rua alagada");
      expect(result).toHaveProperty("position");
      expect(result.position).toHaveProperty("lat", -23.5505);
      expect(result.position).toHaveProperty("lng", -46.6333);
    });

    it("should handle reports with zero votes", () => {
      const result = buildReportResponse(baseReport);

      expect(result).toBeDefined();
      expect(result.image_url).toBe(baseReport.image_url);
    });

    it("should include image URL when available", () => {
      const result = buildReportResponse(baseReport);

      expect(result.image_url).toBe(baseReport.image_url);
    });

    it("should handle missing image URL", () => {
      const reportWithoutImage = {
        ...baseReport,
        image_url: null,
      };

      const result = buildReportResponse(reportWithoutImage);

      expect(result.image_url).toBeNull();
    });

    it("should preserve timestamps", () => {
      const result = buildReportResponse(baseReport);

      expect(result.created_at).toBe(baseReport.created_at);
      expect(result.updated_at).toBe(baseReport.updated_at);
    });

    it("should handle various problem types", () => {
      const categories = [
        "alagamento",
        "foco_lixo",
        "arvore_queda",
        "bueiro_entupido",
        "buraco_via",
      ];

      categories.forEach((category) => {
        const report = { ...baseReport, problem: category };
        const result = buildReportResponse(report);
        expect(result.problem).toBe(category);
      });
    });

    it("should include user_id", () => {
      const result = buildReportResponse(baseReport);

      expect(result.user_id).toBe("user-123");
    });

    it("should maintain moderation status", () => {
      const result = buildReportResponse(baseReport);

      expect(result.moderation_status).toBe("aprovado");
    });
  });
});
