// Builds a shareable step-by-step PDF from the Recorder's draft steps: a title
// header, then one block per step — number + title, the instruction text, and
// the screenshot the recorder captured for that action (when it has one).
// Anyone can open the file and follow the workflow without installing Baymax.
//
// Works straight off the drafts (NOT buildGuide()'s export shape) because the
// screenshots exist only there — buildGuide's field whitelist deliberately
// keeps them out of saves/downloads. Typed parameter values are likewise left
// out of the PDF: same privacy rule as the JSON export (titles/descriptions
// already say what to type where).
import { jsPDF } from 'jspdf'

const MARGIN = 44 // pt
const IMG_MAX_H = 300 // cap so at least one full step fits per A4 page

// jsPDF needs the image's pixel size to keep the aspect ratio.
function loadImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

export async function exportGuidePdf(title, steps) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const contentW = pageW - MARGIN * 2
  let y = MARGIN

  const ensureRoom = (needed) => {
    // Never let a block start in the bottom margin; oversized blocks (a tall
    // screenshot) still get a fresh page and clip gracefully rather than crash.
    if (y + needed <= pageH - MARGIN) return
    doc.addPage()
    y = MARGIN
  }

  // ── Header ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  const titleLines = doc.splitTextToSize(title || 'Recorded guide', contentW)
  doc.text(titleLines, MARGIN, y + 16)
  y += 16 + titleLines.length * 22
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(120)
  const stamp = new Date().toISOString().slice(0, 10)
  doc.text(`${steps.length} step${steps.length === 1 ? '' : 's'} - recorded with Baymax - ${stamp}`, MARGIN, y)
  doc.setTextColor(0)
  y += 14
  doc.setDrawColor(200)
  doc.line(MARGIN, y, pageW - MARGIN, y)
  y += 26

  // ── Steps ──
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i]

    doc.setFontSize(13)
    const heading = doc.splitTextToSize(`Step ${i + 1}: ${s.title || s.name || s.action || 'Step'}`, contentW)
    doc.setFontSize(10.5)
    const desc = s.description ? doc.splitTextToSize(s.description, contentW) : []

    const img = s.screenshot ? await loadImage(s.screenshot) : null
    let imgW = 0
    let imgH = 0
    if (img) {
      const scale = Math.min(contentW / img.naturalWidth, IMG_MAX_H / img.naturalHeight)
      imgW = img.naturalWidth * scale
      imgH = img.naturalHeight * scale
    }

    // Keep a step's text and image together on one page when they fit.
    ensureRoom(heading.length * 17 + desc.length * 14 + (img ? imgH + 14 : 0) + 10)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(heading, MARGIN, y + 12)
    y += heading.length * 17 + 2

    if (desc.length) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10.5)
      doc.setTextColor(70)
      doc.text(desc, MARGIN, y + 10)
      doc.setTextColor(0)
      y += desc.length * 14 + 4
    }

    if (img) {
      ensureRoom(imgH + 14)
      doc.addImage(s.screenshot, 'JPEG', MARGIN, y + 6, imgW, imgH)
      doc.setDrawColor(210)
      doc.rect(MARGIN, y + 6, imgW, imgH) // hairline frame so pale pages read as screenshots

      // Marker box: where the clicked/typed element sat at record time. The
      // rect is CSS px in the tab viewport; the capture is CSS px × dpr, so
      // map css → image px → PDF pt, pad a little, and clamp inside the image.
      const r = s.screenshotRect
      if (r && r.width > 0 && r.height > 0) {
        const dpr = r.dpr || 1
        const toPdf = imgW / img.naturalWidth
        const pad = 4
        let mx = (r.x - pad) * dpr * toPdf
        let my = (r.y - pad) * dpr * toPdf
        let mw = (r.width + pad * 2) * dpr * toPdf
        let mh = (r.height + pad * 2) * dpr * toPdf
        mx = Math.max(0, Math.min(mx, imgW - 2))
        my = Math.max(0, Math.min(my, imgH - 2))
        mw = Math.min(mw, imgW - mx)
        mh = Math.min(mh, imgH - my)
        if (mw > 3 && mh > 3) {
          doc.setDrawColor(225, 29, 72)
          doc.setLineWidth(1.6)
          doc.rect(MARGIN + mx, y + 6 + my, mw, mh)
          doc.setLineWidth(0.2)
        }
      }
      y += imgH + 20
    } else {
      y += 8
    }
    y += 12
  }

  const safe = (title || 'guide').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'guide'
  doc.save(`${safe}.pdf`)
}
