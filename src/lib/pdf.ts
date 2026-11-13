// ─── توليد PDF لملف المريض (بالفرنسية — المعتمد في العيادات الجزائرية) ───
import { jsPDF } from 'jspdf';
import { CLINIC } from './clinic';
import type { Patient, Appointment, PlanItem, Payment, Financial } from './supabase';

const GREEN: [number, number, number] = [37, 63, 49];

function header(doc: jsPDF, title: string) {
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('Dr Ahmed Ouadah — Chirurgien Dentiste', 14, 11);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Sidi Bel Abbes, Algerie  |  ${CLINIC.phoneDisplay}  |  Dim-Jeu 08:00-17:00`, 14, 18);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 36);
  doc.setTextColor(0, 0, 0);
}

function line(doc: jsPDF, y: number, label: string, value: string) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(label, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(value || '-', 60, y);
  return y + 7;
}

const fmtDate = (s?: string) => (s ?? '').slice(0, 10);

/** ملف المريض الكامل: معلومات + مواعيد + خطة + مالية */
export function patientPDF(
  p: Patient,
  appointments: Appointment[],
  plans: PlanItem[],
  payments: Payment[],
  fin: Financial | null,
  serviceLabel: (code: string) => string,
) {
  const doc = new jsPDF();
  header(doc, 'Dossier patient');
  let y = 46;
  y = line(doc, y, 'Nom:', p.full_name);
  y = line(doc, y, 'Code:', p.patient_code ?? '');
  y = line(doc, y, 'Telephone:', p.phone);
  if (p.birth_date) y = line(doc, y, 'Naissance:', fmtDate(p.birth_date));
  if (p.address) y = line(doc, y, 'Adresse:', p.address);
  if (p.medical_history) y = line(doc, y, 'Antecedents:', p.medical_history);

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('Rendez-vous:', 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  appointments.slice(0, 12).forEach((a) => {
    doc.text(`- ${fmtDate(a.appt_date)} ${a.appt_time.slice(0, 5)} : ${serviceLabel(a.service_code)} [${a.status}]`, 18, y);
    y += 6;
    if (y > 270) { doc.addPage(); y = 20; }
  });

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('Plan de traitement:', 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  plans.forEach((pl) => {
    doc.text(`- ${serviceLabel(pl.service_code)} : ${pl.agreed_cost} DA [${pl.status}]`, 18, y);
    y += 6;
    if (y > 270) { doc.addPage(); y = 20; }
  });

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('Paiements:', 14, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  payments.forEach((pay) => {
    doc.text(`- ${fmtDate(pay.created_at)} : ${pay.amount} DA (${pay.method}) ${pay.label ?? ''}`, 18, y);
    y += 6;
    if (y > 270) { doc.addPage(); y = 20; }
  });
  if (fin) {
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${fin.total_cost} DA   Paye: ${fin.amount_paid} DA   Reste: ${Number(fin.total_cost) - Number(fin.amount_paid)} DA`, 14, y);
  }
  doc.save(`dossier-${p.patient_code ?? p.phone}.pdf`);
}

/** وصل دفع */
export function receiptPDF(p: Patient, amount: number, method: string, label?: string) {
  const doc = new jsPDF();
  header(doc, 'Recu de paiement');
  let y = 50;
  y = line(doc, y, 'Patient:', `${p.full_name} (${p.phone})`);
  y = line(doc, y, 'Montant:', `${amount} DA`);
  y = line(doc, y, 'Moyen:', method === 'cash' ? 'Especes' : method === 'ccp' ? 'CCP' : 'Virement');
  if (label) y = line(doc, y, 'Motif:', label);
  y = line(doc, y, 'Date:', new Date().toLocaleDateString('fr-FR'));
  doc.save(`recu-${Date.now()}.pdf`);
}
