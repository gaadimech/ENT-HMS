import type { PrescriptionData } from '@/types/prescription';

// ── Clinic & Doctor config ─────────────────────────────────────────────────
const CLINIC = {
  name:           'PRAGATI ENT HOSPITAL',
  tagline:        'Specialist Clinic for Ear, Nose & Throat Disorders',
  address:        'B-10 Janta Colony, Jaipur, 302004',
  phone:          'Tel: 0141-2600326',
  doctorName:     'Dr. Samanvaya Soni',
  regNo:          'RMC Reg. No.: 38866',
  qualifications: 'MBBS, MS (ENT), DNB, MNA MS',
  fellowship:     'Fellowship in Rhinoplasty, Endoscopic Ear & Skull Base Surgery',
};

// ── Layout constants (mm, A4 = 210 × 297) ─────────────────────────────────
const PW   = 210;
const PH   = 297;
const ML   = 15;   // left margin
const MR   = 15;   // right margin
const CW   = PW - ML - MR;  // content width = 180 mm

// Two-column body
const LEFT_W  = 80;                         // left column width
const COL_GAP = 5;                          // gap between columns
const RIGHT_X = ML + LEFT_W + COL_GAP;     // right column start x = 100
const RIGHT_W = PW - MR - RIGHT_X;         // right column width   = 95
const DIV_X   = ML + LEFT_W + COL_GAP / 2; // divider x            = 97.5

// ── Brand colours (R, G, B) ────────────────────────────────────────────────
const BLUE_DARK   = [30,  64, 175] as const;
const BLUE_MID    = [59, 130, 246] as const;
const GREY_DARK   = [31,  41,  55] as const;
const GREY_MID    = [75,  85,  99] as const;
const GREY_LIGHT  = [248, 249, 250] as const;
const GREY_BORDER = [220, 220, 220] as const;
const WHITE       = [255, 255, 255] as const;

function today(): string {
  return new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generatePrescriptionPDF(data: PrescriptionData): Promise<void> {
  const jsPDFModule = await import('jspdf');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsPDFClass = (jsPDFModule as any).jsPDF ?? (jsPDFModule as any).default;
  const doc = new jsPDFClass({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // ── Low-level helpers ────────────────────────────────────────────────────

  const setColor = (rgb: readonly [number, number, number]) =>
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  const setDraw = (rgb: readonly [number, number, number]) =>
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
  const setFill = (rgb: readonly [number, number, number]) =>
    doc.setFillColor(rgb[0], rgb[1], rgb[2]);

  /** Render wrapped text; return y after last line */
  function drawText(
    text: string,
    x: number,
    y: number,
    maxW: number,
    fontSize: number,
    fontStyle  = 'normal',
    color: readonly [number, number, number] = GREY_DARK,
    align: 'left' | 'center' | 'right' = 'left',
  ): number {
    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    setColor(color);
    const lines: string[] = doc.splitTextToSize(text, maxW);
    doc.text(lines, x, y, align !== 'left' ? { align } : {});
    return y + lines.length * (fontSize * 0.45);
  }

  /** Bold coloured heading with a coloured underline; returns y after heading */
  function sectionHead(label: string, x: number, y: number, width: number): number {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    setColor(BLUE_DARK);
    doc.text(label, x, y);
    doc.setLineWidth(0.3);
    setDraw(BLUE_MID);
    doc.line(x, y + 1.2, x + width, y + 1.2);
    return y + 6;
  }

  /** Bullet list; returns y after last item */
  function bulletList(
    items: string[],
    x: number,
    startY: number,
    maxW: number,
    fontSize: number,
  ): number {
    let y = startY;
    const lh = fontSize * 0.48;
    items.forEach(item => {
      const lines: string[] = doc.splitTextToSize(`\u2022  ${item}`, maxW);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);
      setColor(GREY_DARK);
      doc.text(lines, x, y);
      y += lines.length * lh + 0.8;
    });
    return y;
  }

  // ── Diagram helpers ──────────────────────────────────────────────────────

  /** Draw a grey background box with a bold title at the top */
  function diagramBox(x: number, y: number, w: number, h: number, title: string): void {
    setFill(GREY_LIGHT);
    setDraw(GREY_BORDER);
    doc.setLineWidth(0.2);
    doc.rect(x, y, w, h, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    setColor(BLUE_DARK);
    doc.text(title, x + w / 2, y + 4, { align: 'center' });
  }

  /**
   * Tympanic membrane (otoscopic view)
   * cx/cy = centre of the drum circle, r = radius, side 'R'|'L'
   */
  function drawTM(cx: number, cy: number, r: number, side: 'R' | 'L'): void {
    setDraw(GREY_DARK);
    // ① Outer TM circle
    doc.setLineWidth(0.5);
    doc.circle(cx, cy, r, 'S');
    // ② Pars flaccida – small circle near top
    doc.setLineWidth(0.25);
    const pfDx = side === 'R' ? -r * 0.08 : r * 0.08;
    doc.circle(cx + pfDx, cy - r * 0.78, r * 0.16, 'S');
    // ③ Malleus handle – angled line from near top to umbo
    const mTopX = cx + (side === 'R' ? -r * 0.1 : r * 0.1);
    const mTopY = cy - r * 0.6;
    const umboX = cx;
    const umboY = cy + r * 0.12;
    doc.setLineWidth(0.65);
    doc.line(mTopX, mTopY, umboX, umboY);
    // ④ Umbo – small filled dot
    setDraw(GREY_DARK);
    setFill(GREY_DARK);
    doc.setLineWidth(0.15);
    doc.circle(umboX, umboY, 0.65, 'F');
    // ⑤ Light reflex – small filled ellipse in anteroinferior quadrant
    const lrDx = side === 'R' ? r * 0.28 : -r * 0.28;
    setFill([230, 230, 230]);
    setDraw(GREY_MID);
    doc.setLineWidth(0.15);
    doc.ellipse(cx + lrDx, cy + r * 0.38, r * 0.14, r * 0.09, 'FD');
    // restore
    setFill(GREY_LIGHT);
  }

  /**
   * Anterior rhinoscopy – nasal cavity cross-section
   * cx/cy = centre, rx/ry = horizontal/vertical radii of cavity oval
   */
  function drawRhinoscopy(cx: number, cy: number, rx: number, ry: number): void {
    setDraw(GREY_DARK);
    // Outer oval
    doc.setLineWidth(0.5);
    doc.ellipse(cx, cy, rx, ry, 'S');
    // Nasal septum – vertical centre line
    doc.setLineWidth(0.45);
    doc.line(cx, cy - ry * 0.85, cx, cy + ry * 0.85);
    // Inferior turbinates – small ellipses inside, one each side
    doc.setLineWidth(0.3);
    setDraw([130, 130, 130]);
    doc.ellipse(cx - rx * 0.52, cy + ry * 0.22, rx * 0.28, ry * 0.18, 'S');
    doc.ellipse(cx + rx * 0.52, cy + ry * 0.22, rx * 0.28, ry * 0.18, 'S');
    setDraw(GREY_DARK);
  }

  /**
   * Indirect laryngoscopy (mirror view from above)
   * cx/cy = centre, r = radius
   */
  function drawLaryngoscopy(cx: number, cy: number, r: number): void {
    setDraw(GREY_DARK);
    // Outer circle (mirror)
    doc.setLineWidth(0.5);
    doc.circle(cx, cy, r, 'S');
    // Epiglottis – curved arch at top
    doc.setLineWidth(0.4);
    doc.ellipse(cx, cy - r * 0.38, r * 0.42, r * 0.18, 'S');
    // Vocal cords – V-shape (two lines converging at subglottis)
    const vcTopY = cy - r * 0.2;
    const vcBotY = cy + r * 0.58;
    doc.setLineWidth(0.55);
    doc.line(cx - r * 0.48, vcTopY, cx,          vcBotY); // left VC
    doc.line(cx + r * 0.48, vcTopY, cx,          vcBotY); // right VC
    // Arytenoids – two small circles at upper-posterior
    doc.setLineWidth(0.25);
    setDraw([130, 130, 130]);
    doc.circle(cx - r * 0.3, cy + r * 0.05, r * 0.12, 'S');
    doc.circle(cx + r * 0.3, cy + r * 0.05, r * 0.12, 'S');
    setDraw(GREY_DARK);
  }

  /**
   * Oropharynx (mouth-open anterior view)
   * cx/cy = centre, rx/ry = radii of the opening oval
   */
  function drawOropharynx(cx: number, cy: number, rx: number, ry: number): void {
    setDraw(GREY_DARK);
    // Outer oval (pharyngeal opening)
    doc.setLineWidth(0.5);
    doc.ellipse(cx, cy, rx, ry, 'S');
    // Uvula – small teardrop at superior midline
    doc.setLineWidth(0.35);
    doc.ellipse(cx, cy - ry * 0.5, rx * 0.09, ry * 0.16, 'S');
    doc.line(cx, cy - ry * 0.34, cx, cy - ry * 0.12);
    // Tonsils – oval bulges on either side (upper area)
    doc.setLineWidth(0.3);
    setDraw([130, 130, 130]);
    doc.ellipse(cx - rx * 0.65, cy - ry * 0.08, rx * 0.2, ry * 0.32, 'S');
    doc.ellipse(cx + rx * 0.65, cy - ry * 0.08, rx * 0.2, ry * 0.32, 'S');
    // Posterior pharyngeal wall – horizontal line
    setDraw(GREY_DARK);
    doc.setLineWidth(0.3);
    doc.line(cx - rx * 0.72, cy + ry * 0.6, cx + rx * 0.72, cy + ry * 0.6);
    // Tongue – large shallow ellipse at bottom
    doc.setLineWidth(0.4);
    doc.ellipse(cx, cy + ry * 0.82, rx * 0.88, ry * 0.2, 'S');
  }

  // ════════════════════════════════════════════════════════════════════════
  // HEADER
  // ════════════════════════════════════════════════════════════════════════
  let y = 12;

  // ── Logo block (left 36 mm) ──────────────────────────────────────────
  const LOGO_X = ML;
  const LOGO_W = 36;
  const LOGO_H = 30;
  setFill(BLUE_DARK);
  setDraw(BLUE_DARK);
  doc.setLineWidth(0.1);
  doc.rect(LOGO_X, y, LOGO_W, LOGO_H, 'F');
  // Large "P" initial
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  setColor(WHITE);
  doc.text('P', LOGO_X + LOGO_W / 2, y + 12, { align: 'center' });
  // Sub-label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('PRAGATI', LOGO_X + LOGO_W / 2, y + 19, { align: 'center' });
  doc.text('ENT',     LOGO_X + LOGO_W / 2, y + 24, { align: 'center' });
  doc.text('HOSPITAL',LOGO_X + LOGO_W / 2, y + 29, { align: 'center' });

  // ── Hospital name + contact (right of logo) ──────────────────────────
  const hX = LOGO_X + LOGO_W + 4;
  const hW = PW - MR - hX;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  setColor(BLUE_DARK);
  doc.text(CLINIC.name, hX + hW / 2, y + 8, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(GREY_MID);
  doc.text(CLINIC.tagline, hX + hW / 2, y + 14.5, { align: 'center' });
  doc.text(CLINIC.address, hX + hW / 2, y + 20,   { align: 'center' });
  doc.text(CLINIC.phone,   hX + hW / 2, y + 25.5, { align: 'center' });

  y = y + LOGO_H + 3; // y ≈ 45

  // ── Thick blue divider ───────────────────────────────────────────────
  doc.setLineWidth(1.0);
  setDraw(BLUE_DARK);
  doc.line(ML, y, PW - MR, y);
  y += 5;

  // ── Doctor details row ───────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  setColor(GREY_DARK);
  doc.text(CLINIC.doctorName, ML, y);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor(GREY_MID);
  doc.text(`Date: ${today()}`, PW - MR, y, { align: 'right' });
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(GREY_MID);
  doc.text(CLINIC.regNo,          ML, y); y += 4.5;
  doc.text(CLINIC.qualifications, ML, y); y += 4.5;
  doc.text(CLINIC.fellowship,     ML, y); y += 4;

  // Thin divider
  doc.setLineWidth(0.3);
  setDraw(GREY_BORDER);
  doc.line(ML, y, PW - MR, y);
  y += 4;

  // ════════════════════════════════════════════════════════════════════════
  // PATIENT INFO BOX
  // ════════════════════════════════════════════════════════════════════════
  const pBoxH = 22;
  const pPad  = 4;
  setFill(GREY_LIGHT);
  setDraw(GREY_BORDER);
  doc.setLineWidth(0.25);
  doc.rect(ML, y, CW, pBoxH, 'FD');

  const py1 = y + 7;
  const py2 = y + 15;

  // Row 1 – Patient | Age | Sex
  const c1 = ML + pPad;
  doc.setFont('helvetica', 'bold');   doc.setFontSize(7.5); setColor(GREY_MID);
  doc.text('PATIENT:', c1, py1);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); setColor(GREY_DARK);
  doc.text(data.patientInfo.name || '—', c1 + 20, py1);

  const c2 = ML + 90;
  doc.setFont('helvetica', 'bold');   doc.setFontSize(7.5); setColor(GREY_MID);
  doc.text('AGE:', c2, py1);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); setColor(GREY_DARK);
  doc.text(data.patientInfo.age || '—', c2 + 11, py1);

  const c3 = ML + 132;
  doc.setFont('helvetica', 'bold');   doc.setFontSize(7.5); setColor(GREY_MID);
  doc.text('SEX:', c3, py1);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); setColor(GREY_DARK);
  doc.text(data.patientInfo.sex || '—', c3 + 11, py1);

  // Row 2 – Chief Complaint
  doc.setFont('helvetica', 'bold');   doc.setFontSize(7.5); setColor(GREY_MID);
  doc.text('CHIEF COMPLAINT:', c1, py2);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);   setColor(GREY_DARK);
  const ccMaxW = CW - pPad * 2 - 40;
  const ccLine = doc.splitTextToSize(data.patientInfo.preliminaryPresentation || '—', ccMaxW)[0] ?? '';
  doc.text(ccLine, c1 + 40, py2);

  y += pBoxH + 4;

  // ── Rx symbol + thin rule ────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  setColor(BLUE_DARK);
  doc.text('Rx', ML, y + 5);
  doc.setLineWidth(0.3);
  setDraw(GREY_BORDER);
  doc.line(ML + 13, y + 2.5, PW - MR, y + 2.5);
  y += 10;

  // ════════════════════════════════════════════════════════════════════════
  // BODY — two columns
  // ════════════════════════════════════════════════════════════════════════
  const bodyTopY = y;
  let leftY  = bodyTopY;
  let rightY = bodyTopY;

  // ──────────────────────────────────────────────────────────────────────
  // LEFT COLUMN   Symptoms → Examinations → Advice
  // ──────────────────────────────────────────────────────────────────────
  leftY = sectionHead('SYMPTOMS', ML, leftY, LEFT_W);
  if (data.symptoms.length > 0) {
    leftY = bulletList(data.symptoms, ML, leftY, LEFT_W - 2, 9);
  } else {
    drawText('Not reported', ML, leftY, LEFT_W, 8.5, 'italic', GREY_MID);
    leftY += 5;
  }

  leftY += 3;
  leftY = sectionHead('EXAMINATIONS', ML, leftY, LEFT_W);
  if (data.examinations.length > 0) {
    leftY = bulletList(data.examinations, ML, leftY, LEFT_W - 2, 9);
  } else {
    drawText('Not documented', ML, leftY, LEFT_W, 8.5, 'italic', GREY_MID);
    leftY += 5;
  }

  leftY += 3;
  leftY = sectionHead('ADVICE', ML, leftY, LEFT_W);
  const advText = data.recommendation?.trim() || 'Follow standard post-treatment care. Avoid self-medication.';
  leftY = drawText(advText, ML, leftY, LEFT_W - 2, 8.5, 'normal', GREY_DARK) + 1;

  // ──────────────────────────────────────────────────────────────────────
  // RIGHT COLUMN  Clinical Diagrams → Diagnosis → Investigations
  // ──────────────────────────────────────────────────────────────────────

  // ① Section heading
  rightY = sectionHead('CLINICAL DIAGRAMS', RIGHT_X, rightY, RIGHT_W);

  // Diagram geometry
  const DW       = (RIGHT_W - 3) / 2;  // each box width  ≈ 46 mm
  const DH       = 26;                  // each box height
  const DROW_GAP = 2;                   // vertical gap between diagram rows

  // Centre y for diagram content (below the 5 mm title area inside the box)
  const diagCY = (offset: number) => offset + 5 + (DH - 5) / 2;

  // Row 1 ─ Right TM | Left TM
  const r1y = rightY;
  diagramBox(RIGHT_X,          r1y, DW, DH, 'RIGHT TYMPANIC MEMBRANE');
  drawTM(RIGHT_X + DW / 2,     diagCY(r1y), DH * 0.33, 'R');

  diagramBox(RIGHT_X + DW + 3, r1y, DW, DH, 'LEFT TYMPANIC MEMBRANE');
  drawTM(RIGHT_X + DW + 3 + DW / 2, diagCY(r1y), DH * 0.33, 'L');

  // Row 2 ─ Anterior Rhinoscopy | Indirect Laryngoscopy
  const r2y = r1y + DH + DROW_GAP;
  diagramBox(RIGHT_X,          r2y, DW, DH, 'ANTERIOR RHINOSCOPY');
  drawRhinoscopy(RIGHT_X + DW / 2, diagCY(r2y), DW * 0.28, DH * 0.28);

  diagramBox(RIGHT_X + DW + 3, r2y, DW, DH, 'INDIRECT LARYNGOSCOPY');
  drawLaryngoscopy(RIGHT_X + DW + 3 + DW / 2, diagCY(r2y), DW * 0.28);

  // Row 3 ─ Oropharynx (full right-column width)
  const r3y = r2y + DH + DROW_GAP;
  diagramBox(RIGHT_X, r3y, RIGHT_W, DH, 'OROPHARYNX');
  drawOropharynx(RIGHT_X + RIGHT_W / 2, diagCY(r3y), RIGHT_W * 0.2, DH * 0.3);

  rightY = r3y + DH + DROW_GAP + 3;

  // ② Diagnosis
  rightY = sectionHead('DIAGNOSIS / PRESENTATION', RIGHT_X, rightY, RIGHT_W);
  const diagLines: string[] = doc.splitTextToSize(
    data.presentation?.trim() || 'Not specified', RIGHT_W - 2,
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(GREY_DARK);
  doc.text(diagLines, RIGHT_X, rightY);
  rightY += diagLines.length * 4.3 + 4;

  // ③ Investigations
  const investigations = data.investigations ?? [];
  rightY = sectionHead('INVESTIGATIONS', RIGHT_X, rightY, RIGHT_W);
  if (investigations.length > 0) {
    rightY = bulletList(investigations, RIGHT_X, rightY, RIGHT_W - 2, 8.5);
  } else {
    drawText('None ordered', RIGHT_X, rightY, RIGHT_W, 8.5, 'italic', GREY_MID);
    rightY += 5;
  }

  // ── Vertical column divider ──────────────────────────────────────────
  const bodyBotY = Math.max(leftY, rightY) + 3;
  doc.setLineWidth(0.2);
  setDraw(GREY_BORDER);
  doc.line(DIV_X, bodyTopY - 2, DIV_X, bodyBotY);

  // ════════════════════════════════════════════════════════════════════════
  // FULL-WIDTH — PRESCRIBED MEDICATIONS
  // ════════════════════════════════════════════════════════════════════════
  y = bodyBotY + 2;

  // Thin separator
  doc.setLineWidth(0.3);
  setDraw(GREY_BORDER);
  doc.line(ML, y, PW - MR, y);
  y += 5;

  y = sectionHead('PRESCRIBED MEDICATIONS', ML, y, CW);

  if (data.medications.length > 0) {
    // Column header row
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    setColor(GREY_MID);
    doc.text('MEDICINE',   ML,           y);
    doc.text('DOSE',       ML + CW * 0.44, y);
    doc.text('FREQUENCY',  ML + CW * 0.57, y);
    doc.text('DURATION',   ML + CW * 0.73, y);
    doc.setLineWidth(0.2);
    setDraw(GREY_BORDER);
    doc.line(ML, y + 1.5, PW - MR, y + 1.5);
    y += 5;

    data.medications.forEach((med, idx) => {
      // Page overflow guard
      if (y > PH - 50) {
        doc.addPage();
        y = 20;
      }
      // Number + name (bold, ~43 % of width)
      const nameText = `${idx + 1}.  ${med.medicineName}`;
      const nameLines: string[] = doc.splitTextToSize(nameText, CW * 0.42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      setColor(GREY_DARK);
      doc.text(nameLines, ML, y);

      // Dose / Frequency / Duration columns (normal, smaller)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      setColor(GREY_DARK);
      const dose  = med.dosage    && med.dosage    !== 'Not specified' ? med.dosage    : '—';
      const freq  = med.frequency && med.frequency !== 'Not specified' ? med.frequency : '—';
      const dur   = med.duration  && med.duration  !== 'Not specified' ? med.duration  : '—';
      doc.text(dose, ML + CW * 0.44, y);
      doc.text(freq, ML + CW * 0.57, y);
      doc.text(dur,  ML + CW * 0.73, y);

      y += nameLines.length * 4.8 + 1.5;
    });
  } else {
    drawText('No medications prescribed.', ML, y, CW, 9, 'italic', GREY_MID);
    y += 6;
  }

  y += 3;

  // ════════════════════════════════════════════════════════════════════════
  // FOOTER — Next Visit | Doctor's Signature
  // ════════════════════════════════════════════════════════════════════════
  // Thick blue footer rule
  doc.setLineWidth(0.8);
  setDraw(BLUE_DARK);
  doc.line(ML, y, PW - MR, y);
  y += 6;

  // Next Visit (left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  setColor(BLUE_DARK);
  doc.text('NEXT VISIT:', ML, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  setColor(GREY_DARK);
  doc.text(data.nextVisit?.trim() || 'As advised by doctor', ML + 29, y);

  // Doctor's Signature (right-aligned box)
  const sigW = 58;
  const sigX = PW - MR - sigW;
  doc.setLineWidth(0.35);
  setDraw(GREY_MID);
  doc.line(sigX, y + 14, PW - MR, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  setColor(GREY_MID);
  doc.text("Doctor's Signature", sigX + sigW / 2, y + 18.5, { align: 'center' });

  // Fine print at page bottom
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  setColor(GREY_MID);
  doc.text(
    'This prescription is electronically generated and is valid for 30 days from the date of issue.',
    PW / 2,
    PH - 8,
    { align: 'center' },
  );

  // ── Save ─────────────────────────────────────────────────────────────
  const safeName = (data.patientInfo.name || 'patient')
    .replace(/[^a-z0-9\s]/gi, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();
  doc.save(`prescription_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
