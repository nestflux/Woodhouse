/**
 * PDF resume generation using pdf-lib (pure JS — works in Deno Edge Functions).
 *
 * Layout: Letter size (8.5" × 11"), 1" margins, Helvetica font family.
 * Professional, single-column, ATS-friendly design.
 */

import {
  PDFDocument,
  StandardFonts,
  rgb,
} from "npm:pdf-lib@1";
import type { PDFFont, PDFPage } from "npm:pdf-lib@1";
import type { ResumeContent } from "./types.ts";

const PAGE_WIDTH = 612; // 8.5" in points
const PAGE_HEIGHT = 792; // 11" in points
const MARGIN_X = 60;
const MARGIN_TOP = 60;
const MARGIN_BOTTOM = 60;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN_X;
const LINE_HEIGHT_FACTOR = 1.35;

const FONT_SIZE = {
  name: 20,
  headline: 11,
  contact: 9,
  sectionHeading: 12,
  companyName: 11,
  jobTitle: 10,
  body: 10,
  small: 9,
};

const COLOR = {
  black: rgb(0, 0, 0),
  darkGray: rgb(0.2, 0.2, 0.2),
  mediumGray: rgb(0.4, 0.4, 0.4),
  lightGray: rgb(0.6, 0.6, 0.6),
  rule: rgb(0.75, 0.75, 0.75),
};

class PdfResumeBuilder {
  private doc!: PDFDocument;
  private page!: PDFPage;
  private y = 0;
  private font!: PDFFont;
  private boldFont!: PDFFont;
  private italicFont!: PDFFont;
  private boldItalicFont!: PDFFont;

  async init(): Promise<void> {
    this.doc = await PDFDocument.create();
    this.font = await this.doc.embedFont(StandardFonts.Helvetica);
    this.boldFont = await this.doc.embedFont(StandardFonts.HelveticaBold);
    this.italicFont = await this.doc.embedFont(StandardFonts.HelveticaOblique);
    this.boldItalicFont = await this.doc.embedFont(
      StandardFonts.HelveticaBoldOblique
    );
    this.newPage();
  }

  private newPage(): void {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.y = PAGE_HEIGHT - MARGIN_TOP;
  }

  private ensureSpace(height: number): void {
    if (this.y - height < MARGIN_BOTTOM) {
      this.newPage();
    }
  }

  private wrapText(
    text: string,
    font: PDFFont,
    size: number,
    maxWidth: number
  ): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      if (!word) continue;
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = font.widthOfTextAtSize(testLine, size);

      if (testWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        // Handle single words wider than maxWidth
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          lines.push(word);
          currentLine = "";
        } else {
          currentLine = word;
        }
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines.length > 0 ? lines : [""];
  }

  private drawTextLines(
    lines: string[],
    font: PDFFont,
    size: number,
    color = COLOR.darkGray,
    indent = 0
  ): void {
    const lineHeight = size * LINE_HEIGHT_FACTOR;
    for (const line of lines) {
      this.ensureSpace(lineHeight);
      this.page.drawText(line, {
        x: MARGIN_X + indent,
        y: this.y,
        size,
        font,
        color,
      });
      this.y -= lineHeight;
    }
  }

  private drawCenteredText(
    text: string,
    font: PDFFont,
    size: number,
    color = COLOR.black
  ): void {
    const textWidth = font.widthOfTextAtSize(text, size);
    const x = (PAGE_WIDTH - textWidth) / 2;
    this.page.drawText(text, { x, y: this.y, size, font, color });
    this.y -= size * LINE_HEIGHT_FACTOR;
  }

  private drawHorizontalRule(): void {
    this.page.drawLine({
      start: { x: MARGIN_X, y: this.y + 4 },
      end: { x: PAGE_WIDTH - MARGIN_X, y: this.y + 4 },
      thickness: 0.5,
      color: COLOR.rule,
    });
    this.y -= 6;
  }

  private drawSectionHeading(title: string): void {
    this.ensureSpace(30);
    this.y -= 8;
    this.page.drawText(title.toUpperCase(), {
      x: MARGIN_X,
      y: this.y,
      size: FONT_SIZE.sectionHeading,
      font: this.boldFont,
      color: COLOR.black,
    });
    this.y -= FONT_SIZE.sectionHeading * LINE_HEIGHT_FACTOR;
    this.drawHorizontalRule();
  }

  private drawTwoColumnLine(
    left: string,
    leftFont: PDFFont,
    leftSize: number,
    right: string,
    rightFont: PDFFont,
    rightSize: number,
    color = COLOR.darkGray
  ): void {
    const lineHeight = Math.max(leftSize, rightSize) * LINE_HEIGHT_FACTOR;
    this.ensureSpace(lineHeight);

    this.page.drawText(left, {
      x: MARGIN_X,
      y: this.y,
      size: leftSize,
      font: leftFont,
      color,
    });

    const rightWidth = rightFont.widthOfTextAtSize(right, rightSize);
    this.page.drawText(right, {
      x: PAGE_WIDTH - MARGIN_X - rightWidth,
      y: this.y,
      size: rightSize,
      font: rightFont,
      color: COLOR.mediumGray,
    });

    this.y -= lineHeight;
  }

  // ─── Section Renderers ──────────────────────────────────────────────────

  private renderHeader(header: ResumeContent["header"]): void {
    // Full name — large, centered
    this.drawCenteredText(
      header.full_name,
      this.boldFont,
      FONT_SIZE.name,
      COLOR.black
    );

    // Headline — centered
    if (header.headline) {
      this.drawCenteredText(
        header.headline,
        this.font,
        FONT_SIZE.headline,
        COLOR.mediumGray
      );
    }

    this.y -= 2;

    // Contact line — centered, joined with " | "
    const contactParts: string[] = [];
    if (header.email) contactParts.push(header.email);
    if (header.phone) contactParts.push(header.phone);
    if (header.location) contactParts.push(header.location);
    if (header.linkedin_url) {
      contactParts.push(
        header.linkedin_url.replace(/^https?:\/\/(www\.)?/, "")
      );
    }
    if (header.portfolio_url) {
      contactParts.push(
        header.portfolio_url.replace(/^https?:\/\/(www\.)?/, "")
      );
    }

    if (contactParts.length > 0) {
      const contactLine = contactParts.join("  |  ");
      this.drawCenteredText(
        contactLine,
        this.font,
        FONT_SIZE.contact,
        COLOR.mediumGray
      );
    }

    this.y -= 4;
  }

  private renderSummary(summary: string): void {
    this.drawSectionHeading("Professional Summary");
    const lines = this.wrapText(
      summary,
      this.font,
      FONT_SIZE.body,
      CONTENT_WIDTH
    );
    this.drawTextLines(lines, this.font, FONT_SIZE.body, COLOR.darkGray);
  }

  private renderExperience(
    experiences: ResumeContent["work_experience"]
  ): void {
    if (experiences.length === 0) return;
    this.drawSectionHeading("Experience");

    for (let i = 0; i < experiences.length; i++) {
      const exp = experiences[i];
      if (i > 0) this.y -= 6;

      // Company Name + Dates
      const dateStr = `${exp.start_date} – ${exp.end_date}`;
      this.drawTwoColumnLine(
        exp.company_name,
        this.boldFont,
        FONT_SIZE.companyName,
        dateStr,
        this.font,
        FONT_SIZE.small
      );

      // Job Title + Location
      const locationStr = exp.location || "";
      this.drawTwoColumnLine(
        exp.job_title,
        this.italicFont,
        FONT_SIZE.jobTitle,
        locationStr,
        this.italicFont,
        FONT_SIZE.small,
        COLOR.mediumGray
      );

      // Achievements
      for (const achievement of exp.achievements) {
        const bulletText = `• ${achievement.text}`;
        const lines = this.wrapText(
          bulletText,
          this.font,
          FONT_SIZE.body,
          CONTENT_WIDTH - 10
        );
        // First line at normal indent, continuation lines with extra indent
        for (let j = 0; j < lines.length; j++) {
          const indent = j === 0 ? 8 : 18;
          this.ensureSpace(FONT_SIZE.body * LINE_HEIGHT_FACTOR);
          this.page.drawText(lines[j], {
            x: MARGIN_X + indent,
            y: this.y,
            size: FONT_SIZE.body,
            font: this.font,
            color: COLOR.darkGray,
          });
          this.y -= FONT_SIZE.body * LINE_HEIGHT_FACTOR;
        }
      }
    }
  }

  private renderSkills(skills: string[]): void {
    if (skills.length === 0) return;
    this.drawSectionHeading("Skills");
    const skillText = skills.join("  •  ");
    const lines = this.wrapText(
      skillText,
      this.font,
      FONT_SIZE.body,
      CONTENT_WIDTH
    );
    this.drawTextLines(lines, this.font, FONT_SIZE.body, COLOR.darkGray);
  }

  private renderEducation(education: ResumeContent["education"]): void {
    if (education.length === 0) return;
    this.drawSectionHeading("Education");

    for (let i = 0; i < education.length; i++) {
      const edu = education[i];
      if (i > 0) this.y -= 4;

      this.drawTwoColumnLine(
        edu.institution,
        this.boldFont,
        FONT_SIZE.companyName,
        edu.dates,
        this.font,
        FONT_SIZE.small
      );

      const degreeStr = edu.field_of_study
        ? `${edu.degree} in ${edu.field_of_study}`
        : edu.degree;
      this.ensureSpace(FONT_SIZE.body * LINE_HEIGHT_FACTOR);
      this.page.drawText(degreeStr, {
        x: MARGIN_X + 8,
        y: this.y,
        size: FONT_SIZE.body,
        font: this.font,
        color: COLOR.darkGray,
      });
      this.y -= FONT_SIZE.body * LINE_HEIGHT_FACTOR;
    }
  }

  private renderProjects(projects: ResumeContent["projects"]): void {
    if (!projects || projects.length === 0) return;
    this.drawSectionHeading("Projects");

    for (let i = 0; i < projects.length; i++) {
      const proj = projects[i];
      if (i > 0) this.y -= 4;

      this.ensureSpace(FONT_SIZE.companyName * LINE_HEIGHT_FACTOR);
      this.page.drawText(proj.name, {
        x: MARGIN_X,
        y: this.y,
        size: FONT_SIZE.companyName,
        font: this.boldFont,
        color: COLOR.darkGray,
      });
      this.y -= FONT_SIZE.companyName * LINE_HEIGHT_FACTOR;

      const descLines = this.wrapText(
        proj.description,
        this.font,
        FONT_SIZE.body,
        CONTENT_WIDTH - 8
      );
      this.drawTextLines(
        descLines,
        this.font,
        FONT_SIZE.body,
        COLOR.darkGray,
        8
      );

      if (proj.technologies.length > 0) {
        const techStr = `Technologies: ${proj.technologies.join(", ")}`;
        const techLines = this.wrapText(
          techStr,
          this.italicFont,
          FONT_SIZE.small,
          CONTENT_WIDTH - 8
        );
        this.drawTextLines(
          techLines,
          this.italicFont,
          FONT_SIZE.small,
          COLOR.mediumGray,
          8
        );
      }
    }
  }

  private renderCertifications(
    certifications: ResumeContent["certifications"]
  ): void {
    if (!certifications || certifications.length === 0) return;
    this.drawSectionHeading("Certifications");

    for (const cert of certifications) {
      const certStr = `${cert.name} — ${cert.issuer}`;
      const lines = this.wrapText(
        certStr,
        this.font,
        FONT_SIZE.body,
        CONTENT_WIDTH
      );
      this.drawTextLines(lines, this.font, FONT_SIZE.body, COLOR.darkGray);
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  async generate(content: ResumeContent): Promise<Uint8Array> {
    await this.init();

    this.renderHeader(content.header);
    this.renderSummary(content.summary);
    this.renderExperience(content.work_experience);
    this.renderSkills(content.skills);
    this.renderEducation(content.education);
    this.renderProjects(content.projects);
    this.renderCertifications(content.certifications);

    return await this.doc.save();
  }
}

export async function generateResumePdf(
  content: ResumeContent
): Promise<Uint8Array> {
  const builder = new PdfResumeBuilder();
  return await builder.generate(content);
}
