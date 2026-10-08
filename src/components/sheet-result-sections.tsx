"use client";

import { ResultTextViewer } from "./result-text-viewer";
import { evidenceSectionIndex, groupSheetResultSections, isCodeSheetField, sectionFieldsForDisplay, sheetFieldDisplayLabel, type SheetSection } from "@/lib/sheet-sections";
import { splitHighlightedText } from "@/lib/result-preview";
import { ImageViewerGallery, type ViewerImage } from "./image-viewer-gallery";

const EMPTY_IMAGES: ViewerImage[] = [];

export function SheetResultSections({ sections, images = EMPTY_IMAGES, sheetName = "" }: { sections: SheetSection[]; images?: ViewerImage[]; sheetName?: string }) {
  const groups = groupSheetResultSections(sections);
  const assigned = images.map(image => ({ image, index: evidenceSectionIndex(image.name, sheetName, groups) }));
  const unassigned = assigned.filter(item => item.index < 0).map(item => item.image);
  return <div className="sheet-result-sections">
    {groups.map((group, index) => <section className="sheet-spatial-result" key={group.sections[0].id}>
      <h4>ชุดผลการทดสอบ {index + 1}</h4>
      {group.sections.map(section => <div className="sheet-result-section" key={section.id}>
      <dl className="sheet-result-fields">
        {sectionFieldsForDisplay(section).map(field => <div key={field.ref}>
          {sheetFieldDisplayLabel(field) && <dt>{sheetFieldDisplayLabel(field)}</dt>}
          <dd>{field.link && /^https?:\/\//i.test(field.link) && !isCodeSheetField(field)
            ? <a href={field.link} target="_blank" rel="noopener noreferrer">{splitHighlightedText(field.value, field.highlights).map((part, index) => <span key={index} style={{ color: part.color, backgroundColor: part.background, fontWeight: part.bold ? 700 : undefined }}>{part.text}</span>)}</a>
            : isCodeSheetField(field)
            ? <ResultTextViewer title={sheetFieldDisplayLabel(field) || "ข้อมูล"} text={field.value} highlights={field.highlights} />
            : <p className="sheet-field-prose">{splitHighlightedText(field.value, field.highlights).map((part, index) => <span key={index} style={{ color: part.color, backgroundColor: part.background, fontWeight: part.bold ? 700 : undefined }}>{part.text}</span>)}</p>}</dd>
        </div>)}
      </dl>
      </div>)}
      <ImageViewerGallery images={assigned.filter(item => item.index === index).map(item => item.image)} />
    </section>)}
    {unassigned.length > 0 && <section className="sheet-spatial-result"><h4>หลักฐานที่ยังจับคู่ section ไม่ได้</h4><ImageViewerGallery images={unassigned} /></section>}
  </div>;
}
