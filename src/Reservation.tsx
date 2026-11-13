import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Check, ArrowLeft,
  User, Phone, Mail, ArrowUpRight, MapPin
} from 'lucide-react';
import { translations } from './translations';
import type { Language } from './translations';
import { CLINIC, SERVICE_IDS, TIME_SLOTS, isWorkDay, toYMD, validDZPhone, normalizeDZPhone } from './lib/clinic';
import { getBookedTimes, createBooking } from './lib/supabase';

const CARE_TYPES = [...SERVICE_IDS];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function Reservation({ lang }: { lang: Language }) {
  const t = translations[lang].reservation;
  
  const [step, setStep] = useState(1);
  const [selectedCare, setSelectedCare] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' });
  const [submitted, setSubmitted] = useState(false);
  const [booked, setBooked] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Calendar state
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const daysInMonth = useMemo(() => getDaysInMonth(viewYear, viewMonth), [viewYear, viewMonth]);
  const firstDay = useMemo(() => getFirstDayOfMonth(viewYear, viewMonth), [viewYear, viewMonth]);

  // Previous month days for leading blanks
  const prevMonthDays = useMemo(() => getDaysInMonth(viewYear, viewMonth - 1), [viewYear, viewMonth]);

  const calendarDays = useMemo(() => {
    const days: { day: number; inMonth: boolean; date: Date }[] = [];

    // Leading days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      days.push({ day: d, inMonth: false, date: new Date(viewYear, viewMonth - 1, d) });
    }

    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ day: i, inMonth: true, date: new Date(viewYear, viewMonth, i) });
    }

    // Trailing days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, inMonth: false, date: new Date(viewYear, viewMonth + 1, i) });
    }

    return days;
  }, [viewYear, viewMonth, daysInMonth, firstDay, prevMonthDays]);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  }

  function isToday(date: Date) {
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  }

  function isSelected(date: Date) {
    if (!selectedDate) return false;
    return date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear();
  }

  function isPast(date: Date) {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return date < todayStart;
  }

  function isClosedDay(date: Date) {
    return !isWorkDay(date);
  }

  function handleSelectCare(care: string) {
    setSelectedCare(care);
    setTimeout(() => setStep(2), 400);
  }

  function handleSelectDate(date: Date) {
    if (isPast(date) || isClosedDay(date) || !calendarDays.find(d => d.date === date)?.inMonth) return;
    setSelectedDate(date);
    setSelectedTime(null);
  }

  function handleSelectTime(time: string) {
    setSelectedTime(time);
    setTimeout(() => setStep(3), 400);
  }

  // تحميل الأوقات المحجوزة لليوم المختار (حجز حقيقي — يمنع المزدوج)
  useEffect(() => {
    if (!selectedDate) { setBooked([]); return; }
    let live = true;
    getBookedTimes(toYMD(selectedDate)).then((times) => {
      if (live) setBooked(times);
    });
    return () => { live = false; };
  }, [selectedDate, submitted]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    const phone = normalizeDZPhone(formData.phone);
    if (!selectedCare || !selectedDate || !selectedTime || !formData.name.trim() || !phone) {
      setFormError(t.requiredError);
      return;
    }
    if (!validDZPhone(phone)) {
      setFormError(t.phoneError);
      return;
    }
    setSubmitting(true);
    const res = await createBooking({
      name: formData.name.trim(),
      phone,
      service: selectedCare,
      date: toYMD(selectedDate),
      time: selectedTime,
      notes: formData.email.trim() || undefined,
    });
    setSubmitting(false);
    if (!res.ok) {
      if (res.reason === 'taken') {
        setFormError(t.takenError);
        getBookedTimes(toYMD(selectedDate)).then(setBooked);
      } else {
        setFormError(t.submitError);
      }
      return;
    }
    setSubmitted(true);
  }

  function resetForm() {
    setStep(1);
    setSelectedCare(null);
    setSelectedDate(null);
    setSelectedTime(null);
    setFormData({ name: '', phone: '', email: '' });
    setSubmitted(false);
  }

  const stepVariants = {
    enter: { opacity: 0, x: 20 },
    center: { opacity: 1, x: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2 } }
  };

  return (
    <section className="reservation-section">
      <div className="reservation-box">
        {/* Left Column */}
        <div className="res-left">
          <span className="res-overline">{t.overline}</span>
          <h2 className="res-title">{t.title}</h2>
          <p className="res-desc">{t.description}</p>
          
          <div className="res-contact-pills">
            <a href={`tel:${CLINIC.phoneIntl}`} className="res-contact-pill">
              <Phone size={16} />
              <span dir="ltr">{CLINIC.phoneDisplay}</span>
            </a>
            <a href={CLINIC.mapsUrl} target="_blank" rel="noopener noreferrer" className="res-contact-pill">
              <MapPin size={16} />
              <span>{t.shortAddress}</span>
            </a>
          </div>
          <p className="res-paynote">{t.payNote}</p>
        </div>

        {/* Right Column */}
        <div className="res-right">
          <div className="stepper-new">
            <div className={`step-new ${step >= 1 ? 'active' : ''}`}>
              <div className="step-num">{step > 1 ? <Check size={12} /> : '1'}</div>
              <span>{t.step1}</span>
            </div>
            <div className={`step-new ${step >= 2 ? 'active' : ''}`}>
              <div className="step-num">{step > 2 ? <Check size={12} /> : '2'}</div>
              <span>{t.step2}</span>
            </div>
            <div className={`step-new ${step >= 3 ? 'active' : ''}`}>
              <div className="step-num">3</div>
              <span>{t.step3}</span>
            </div>
          </div>

          <div className="res-body">
            <AnimatePresence mode="wait">
              {/* Step 1 */}
              {step === 1 && (
                <motion.div key="step1" variants={stepVariants} initial="enter" animate="center" exit="exit">
                  <h3 className="res-question">{t.careQuestion}</h3>
                  <div className="care-options-grid">
                    {CARE_TYPES.map((care) => (
                      <button
                        key={care}
                        className={`care-option-pill ${selectedCare === care ? 'selected' : ''}`}
                        onClick={() => handleSelectCare(care)}
                      >
                        <span>{(t.careTypes as any)[care] || care}</span>
                        <div className="care-option-icon">
                          {selectedCare === care ? <Check size={14} /> : <ArrowUpRight size={14} />}
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <motion.div key="step2" variants={stepVariants} initial="enter" animate="center" exit="exit">
                  <div className="step2-content-new">
                    <div>
                      <h3 className="res-question">{t.dateQuestion}</h3>
                      <div className="calendar-new">
                        <div className="cal-header-new">
                          <button className="cal-nav-new" onClick={prevMonth}>
                            {lang === 'ar' ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                          </button>
                          <span className="cal-month-new">
                            {t.months[viewMonth]} {viewYear}
                          </span>
                          <button className="cal-nav-new" onClick={nextMonth}>
                            {lang === 'ar' ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
                          </button>
                        </div>
                        <div className="cal-grid-new">
                          {t.days.map((d) => (
                            <div key={d} className="cal-day-header-new">{d}</div>
                          ))}
                          {calendarDays.map((dayObj, idx) => {
                            const disabled = !dayObj.inMonth || isPast(dayObj.date) || isClosedDay(dayObj.date);
                            return (
                              <button
                                key={idx}
                                className={`cal-day-new
                                  ${!dayObj.inMonth ? 'cal-day-outside' : ''}
                                  ${isToday(dayObj.date) && dayObj.inMonth ? 'cal-day-today' : ''}
                                  ${isSelected(dayObj.date) && dayObj.inMonth ? 'selected' : ''}
                                  ${disabled ? 'disabled' : ''}
                                `}
                                onClick={() => !disabled && handleSelectDate(dayObj.date)}
                                disabled={disabled}
                              >
                                {dayObj.day}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="timeslot-container-new">
                      <AnimatePresence>
                        {selectedDate && (
                          <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                          >
                            <h3 className="res-question">{t.timeQuestion}</h3>
                            {TIME_SLOTS.every((s) => booked.includes(s)) ? (
                              <p className="res-noslot">{t.noSlot}</p>
                            ) : (
                            <div className="timeslots-grid-new">
                              {TIME_SLOTS.map((time) => {
                                const taken = booked.includes(time);
                                return (
                                  <button
                                    key={time}
                                    disabled={taken}
                                    className={`timeslot-new ${selectedTime === time ? 'selected' : ''} ${taken ? 'taken' : ''}`}
                                    onClick={() => !taken && handleSelectTime(time)}
                                  >
                                    {time}
                                  </button>
                                );
                              })}
                            </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  <button className="back-btn-new" onClick={() => setStep(1)}>
                    {lang === 'ar' ? <ChevronRight size={16} /> : <ArrowLeft size={16} />} {t.backBtn}
                  </button>
                </motion.div>
              )}

              {/* Step 3 */}
              {step === 3 && !submitted && (
                <motion.div key="step3" variants={stepVariants} initial="enter" animate="center" exit="exit" className="step3-wrapper">
                  <h3 className="res-question">{t.confirmTitle}</h3>

                  <div className="summary-card-new">
                    <div className="summary-item-new">
                      <span className="summary-label-new">{t.summaryCare}</span>
                      <span className="summary-value-new">{(t.careTypes as any)[selectedCare ?? ''] || selectedCare}</span>
                    </div>
                    <div className="summary-item-new">
                      <span className="summary-label-new">{t.summaryDate}</span>
                      <span className="summary-value-new">
                        {selectedDate?.toLocaleDateString(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US', {
                          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                        })}
                      </span>
                    </div>
                    <div className="summary-item-new">
                      <span className="summary-label-new">{t.summaryTime}</span>
                      <span className="summary-value-new">{selectedTime}</span>
                    </div>
                  </div>

                  <form className="confirmation-form-new" onSubmit={handleSubmit}>
                    <div className="form-group-new">
                      <label><User size={16} /> {t.fullName}</label>
                      <input
                        type="text"
                        placeholder={t.namePlaceholder}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group-new">
                      <label><Phone size={16} /> {t.phone}</label>
                      <input
                        type="tel"
                        dir="ltr"
                        style={{ textAlign: 'left' }}
                        placeholder={t.phonePlaceholder}
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group-new">
                      <label><Mail size={16} /> {t.email}</label>
                      <input
                        type="email"
                        placeholder={t.emailPlaceholder}
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>

                    <div className="form-actions-new">
                      <button type="button" className="back-btn-new" onClick={() => setStep(2)}>
                        <ArrowLeft size={16} /> {t.backBtn}
                      </button>
                      <button type="submit" className="confirm-btn-new" disabled={submitting}>
                        {submitting ? '…' : t.confirmBtn}
                      </button>
                    </div>
                    {formError && <p className="form-error-new">{formError}</p>}
                  </form>
                </motion.div>
              )}

              {/* Success */}
              {step === 3 && submitted && (
                <motion.div
                  key="success"
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="success-state-new"
                >
                  <div className="success-icon-new">
                    <Check size={40} strokeWidth={3} />
                  </div>
                  <h3 className="res-question">{t.successTitle}</h3>
                    <p className="success-text-new">
                      {t.successThanks} {formData.name}. {t.successText1} <strong>{(t.careTypes as any)[selectedCare ?? ''] || selectedCare}</strong> {t.successText2}{' '}
                      <strong>
                        {selectedDate?.toLocaleDateString(lang === 'ar' ? 'ar-DZ' : lang === 'fr' ? 'fr-FR' : 'en-US', {
                          weekday: 'long', day: 'numeric', month: 'long'
                        })}
                    </strong>{' '}
                    {t.successText3} <strong>{selectedTime}</strong>.
                  </p>
                  <p className="success-sub-new">{t.successSub}</p>
                  <button className="confirm-btn-new" onClick={resetForm} style={{ marginTop: '2rem' }}>
                    {t.anotherBtn}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
