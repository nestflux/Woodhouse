/**
 * DOCX resume generation using the `docx` npm package.
 *
 * Layout: Professional, single-column, ATS-friendly design matching the PDF output.
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  Packer,
  TabStopPosition,
  TabStopType,
  SectionType,
} from "npm:docx@9";
import type { ResumeContent } from "./types.ts";

// Right-align tab stop at ~6.5" (Letter - margins)
const RIGHT_TAB = TabStopPosition.MAX;

function sectionHeading(title: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 60 },
    border: {
      bottom: {
        color: "BFBFBF",
        space: 1,
        style: BorderStyle.SINGLE,
        size: 4,
      },
    },
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        size: 24,
        font: "Calibri",
        color: "000000",
      }),
    ],
  });
}

function buildHeader(header: ResumeContent["header"]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  // Full name
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({
          text: header.full_name,
          bold: true,
          size: 36,
          font: "Calibri",
        }),
      ],
    })
  );

  // Headline
  if (header.headline) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: header.headline,
            size: 22,
            font: "Calibri",
            color: "666666",
          }),
        ],
      })
    );
  }

  // Contact line
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
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: contactParts.join("  |  "),
            size: 18,
            font: "Calibri",
            color: "888888",
          }),
        ],
      })
    );
  }

  return paragraphs;
}

function buildSummary(summary: string): Paragraph[] {
  return [
    sectionHeading("Professional Summary"),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: summary,
          size: 20,
          font: "Calibri",
          color: "333333",
        }),
      ],
    }),
  ];
}

function buildExperience(
  experiences: ResumeContent["work_experience"]
): Paragraph[] {
  if (experiences.length === 0) return [];

  const paragraphs: Paragraph[] = [sectionHeading("Experience")];

  for (const exp of experiences) {
    const dateStr = `${exp.start_date} – ${exp.end_date}`;

    // Company Name + Dates (tabbed right)
    paragraphs.push(
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
        spacing: { before: 120, after: 20 },
        children: [
          new TextRun({
            text: exp.company_name,
            bold: true,
            size: 22,
            font: "Calibri",
          }),
          new TextRun({ text: "\t", size: 22 }),
          new TextRun({
            text: dateStr,
            size: 18,
            font: "Calibri",
            color: "666666",
          }),
        ],
      })
    );

    // Job Title + Location
    paragraphs.push(
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: exp.job_title,
            italics: true,
            size: 20,
            font: "Calibri",
            color: "444444",
          }),
          ...(exp.location
            ? [
                new TextRun({ text: "\t", size: 20 }),
                new TextRun({
                  text: exp.location,
                  italics: true,
                  size: 18,
                  font: "Calibri",
                  color: "666666",
                }),
              ]
            : []),
        ],
      })
    );

    // Achievement bullets
    for (const achievement of exp.achievements) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 20 },
          indent: { left: 360 },
          bullet: { level: 0 },
          children: [
            new TextRun({
              text: achievement.text,
              size: 20,
              font: "Calibri",
              color: "333333",
            }),
          ],
        })
      );
    }
  }

  return paragraphs;
}

function buildSkills(skills: string[]): Paragraph[] {
  if (skills.length === 0) return [];

  return [
    sectionHeading("Skills"),
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: skills.join("  •  "),
          size: 20,
          font: "Calibri",
          color: "333333",
        }),
      ],
    }),
  ];
}

function buildEducation(education: ResumeContent["education"]): Paragraph[] {
  if (education.length === 0) return [];

  const paragraphs: Paragraph[] = [sectionHeading("Education")];

  for (const edu of education) {
    paragraphs.push(
      new Paragraph({
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT_TAB }],
        spacing: { before: 80, after: 20 },
        children: [
          new TextRun({
            text: edu.institution,
            bold: true,
            size: 22,
            font: "Calibri",
          }),
          new TextRun({ text: "\t", size: 22 }),
          new TextRun({
            text: edu.dates,
            size: 18,
            font: "Calibri",
            color: "666666",
          }),
        ],
      })
    );

    const degreeStr = edu.field_of_study
      ? `${edu.degree} in ${edu.field_of_study}`
      : edu.degree;
    paragraphs.push(
      new Paragraph({
        indent: { left: 360 },
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: degreeStr,
            size: 20,
            font: "Calibri",
            color: "333333",
          }),
        ],
      })
    );
  }

  return paragraphs;
}

function buildProjects(projects?: ResumeContent["projects"]): Paragraph[] {
  if (!projects || projects.length === 0) return [];

  const paragraphs: Paragraph[] = [sectionHeading("Projects")];

  for (const proj of projects) {
    paragraphs.push(
      new Paragraph({
        spacing: { before: 80, after: 20 },
        children: [
          new TextRun({
            text: proj.name,
            bold: true,
            size: 22,
            font: "Calibri",
          }),
        ],
      })
    );

    paragraphs.push(
      new Paragraph({
        indent: { left: 360 },
        spacing: { after: 20 },
        children: [
          new TextRun({
            text: proj.description,
            size: 20,
            font: "Calibri",
            color: "333333",
          }),
        ],
      })
    );

    if (proj.technologies.length > 0) {
      paragraphs.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 40 },
          children: [
            new TextRun({
              text: `Technologies: ${proj.technologies.join(", ")}`,
              italics: true,
              size: 18,
              font: "Calibri",
              color: "666666",
            }),
          ],
        })
      );
    }
  }

  return paragraphs;
}

function buildCertifications(
  certifications?: ResumeContent["certifications"]
): Paragraph[] {
  if (!certifications || certifications.length === 0) return [];

  const paragraphs: Paragraph[] = [sectionHeading("Certifications")];

  for (const cert of certifications) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({
            text: `${cert.name}`,
            bold: true,
            size: 20,
            font: "Calibri",
          }),
          new TextRun({
            text: ` — ${cert.issuer}`,
            size: 20,
            font: "Calibri",
            color: "666666",
          }),
        ],
      })
    );
  }

  return paragraphs;
}

export async function generateResumeDocx(
  content: ResumeContent
): Promise<Uint8Array> {
  const children: Paragraph[] = [
    ...buildHeader(content.header),
    ...buildSummary(content.summary),
    ...buildExperience(content.work_experience),
    ...buildSkills(content.skills),
    ...buildEducation(content.education),
    ...buildProjects(content.projects),
    ...buildCertifications(content.certifications),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {
          type: SectionType.CONTINUOUS,
          page: {
            margin: {
              top: 720, // 0.5" in twips
              bottom: 720,
              left: 1080, // 0.75"
              right: 1080,
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return new Uint8Array(buffer);
}
