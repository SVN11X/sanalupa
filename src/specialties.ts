// Especialidades de Doctoralia Chile (sitemap de especialidades, revisado el 12-10-2026).
// Cada ruta de Doctoralia (/cardiologo/...) se traduce a un área ("Cardiología") y a una profesión ("Médico").
// El área es lo que se muestra y se filtra en el sitio; la profesión agrupa en el filtro "Profesión".
// Si aparece una ruta nueva, se usa el texto que muestra Doctoralia y la profesión genérica.

export type SpecialtyInfo = {slug: string; name: string; profession: string; aliases: string[]};

const M = 'Médico';
const rows: Array<[slug: string, name: string, profession: string, aliases?: string[]]> = [
  ['acupunturista', 'Acupuntura', 'Acupunturista'],
  ['inmunologo-alergologo', 'Inmunología y alergología', M, ['alergologo', 'alergologa', 'inmunologo', 'inmunologa', 'alergia']],
  ['patologo', 'Anatomía patológica', M, ['patologo', 'patologa']],
  ['anestesista', 'Anestesiología', M, ['anestesista', 'anestesiologo']],
  ['cardiocirujano', 'Cirugía cardiovascular', M, ['cardiocirujano', 'cardiocirujana']],
  ['cardiologo', 'Cardiología', M, ['cardiologo', 'cardiologa', 'cardiologia']],
  ['cirujano-general', 'Cirugía general', M, ['cirujano general', 'cirujana general', 'cirujano', 'cirujana']],
  ['cirujano-maxilofacial', 'Cirugía maxilofacial', 'Odontólogo', ['maxilofacial']],
  ['cirujano-pediatrico', 'Cirugía pediátrica', M, ['cirujano pediatrico', 'cirujana pediatrica']],
  ['cirujano-plastico', 'Cirugía plástica', M, ['cirujano plastico', 'cirujana plastica', 'cirugia plastica']],
  ['cirujano-toracico', 'Cirugía de tórax', M, ['cirujano toracico', 'cirujana toracica']],
  ['cirujano-vascular', 'Cirugía vascular', M, ['cirujano vascular', 'cirujana vascular']],
  ['cirujano-bariatrico', 'Cirugía bariátrica', M, ['cirujano bariatrico', 'cirujana bariatrica', 'bariatrica']],
  ['dermatologo', 'Dermatología', M, ['dermatologo', 'dermatologa', 'dermatologia']],
  ['endocrinologo', 'Endocrinología', M, ['endocrinologo', 'endocrinologa', 'endocrinologia', 'endocrino']],
  ['enfermero', 'Enfermería', 'Enfermero', ['enfermero', 'enfermera', 'enfermeria']],
  ['fonoaudiologo', 'Fonoaudiología', 'Fonoaudiólogo', ['fonoaudiologo', 'fonoaudiologa', 'fonoaudiologia', 'fono']],
  ['gastroenterologo', 'Gastroenterología', M, ['gastroenterologo', 'gastroenterologa', 'gastroenterologia', 'gastro']],
  ['genetista', 'Genética clínica', M, ['genetista']],
  ['geriatra', 'Geriatría', M, ['geriatra', 'geriatria']],
  ['hematologo', 'Hematología', M, ['hematologo', 'hematologa', 'hematologia']],
  ['homeopata', 'Homeopatía', 'Terapeuta complementario', ['homeopata', 'homeopatia']],
  ['infectologo', 'Infectología', M, ['infectologo', 'infectologa', 'infectologia']],
  ['kinesiologo', 'Kinesiología', 'Kinesiólogo', ['kinesiologo', 'kinesiologa', 'kinesiologia', 'kine']],
  ['tecnico-en-laboratorio-clinico', 'Laboratorio clínico', 'Técnico en laboratorio clínico', ['laboratorio']],
  ['medico-broncopulmonar', 'Broncopulmonar', M, ['broncopulmonar', 'neumologo', 'neumologa']],
  ['terapeuta-complementario', 'Terapias complementarias', 'Terapeuta complementario', ['terapeuta complementario', 'terapeuta complementaria']],
  ['especialista-en-medicina-de-urgencia', 'Medicina de urgencia', M, ['urgenciologo', 'urgenciologa']],
  ['medico-estetico', 'Medicina estética', M, ['medico estetico', 'medica estetica', 'medicina estetica']],
  ['medico-familiar', 'Medicina familiar', M, ['medico familiar', 'medica familiar', 'medicina familiar']],
  ['fisiatra', 'Fisiatría', M, ['fisiatra', 'fisiatria']],
  ['medico-general', 'Medicina general', M, ['medico general', 'medica general', 'medicina general']],
  ['internista', 'Medicina interna', M, ['internista', 'medicina interna']],
  ['medico-legal', 'Medicina legal', M, ['medico legal', 'medicina legal']],
  ['especialista-en-medicina-nuclear', 'Medicina nuclear', M, ['medicina nuclear']],
  ['especialista-en-medicina-preventiva', 'Medicina preventiva', M, ['medicina preventiva']],
  ['especialista-en-medicina-intensiva', 'Medicina intensiva', M, ['intensivista', 'medicina intensiva']],
  ['especialista-en-salud-publica', 'Salud pública', M, ['salud publica', 'salubrista']],
  ['microbiologo', 'Microbiología', 'Microbiólogo', ['microbiologo', 'microbiologa']],
  ['nefrologo', 'Nefrología', M, ['nefrologo', 'nefrologa', 'nefrologia']],
  ['neurocirujano', 'Neurocirugía', M, ['neurocirujano', 'neurocirujana', 'neurocirugia']],
  ['neurofisiologo-clinico', 'Neurofisiología clínica', M, ['neurofisiologo', 'neurofisiologa']],
  ['neurologo', 'Neurología', M, ['neurologo', 'neurologa', 'neurologia']],
  ['neurologo-pediatrico', 'Neurología pediátrica', M, ['neurologo pediatrico', 'neurologa pediatrica', 'neuropediatra']],
  ['nutricionista', 'Nutrición', 'Nutricionista', ['nutricionista', 'nutricion']],
  ['nutriologo', 'Nutriología', M, ['nutriologo', 'nutriologa', 'nutriologia']],
  ['ginecologo', 'Ginecología y obstetricia', M, ['ginecologo', 'ginecologa', 'ginecologia', 'obstetricia']],
  ['matrona', 'Matronería', 'Matrona', ['matrona', 'matron']],
  ['dentista', 'Odontología', 'Odontólogo', ['dentista', 'odontologo', 'odontologa', 'odontologia']],
  ['odontopediatria', 'Odontopediatría', 'Odontólogo', ['odontopediatra', 'odontopediatria']],
  ['oftalmologo', 'Oftalmología', M, ['oftalmologo', 'oftalmologa', 'oftalmologia']],
  ['oncologo', 'Oncología', M, ['oncologo', 'oncologa', 'oncologia']],
  ['otorrino', 'Otorrinolaringología', M, ['otorrino', 'otorrinolaringologo', 'otorrinolaringologa']],
  ['pediatra', 'Pediatría', M, ['pediatra', 'pediatria']],
  ['podologo', 'Podología', 'Podólogo', ['podologo', 'podologa', 'podologia']],
  ['proctologo', 'Proctología', M, ['proctologo', 'proctologa']],
  ['coloproctologo', 'Coloproctología', M, ['coloproctologo', 'coloproctologa']],
  ['psicologo', 'Psicología', 'Psicólogo', ['psicologo', 'psicologa', 'psicologia']],
  ['psicopedagogo', 'Psicopedagogía', 'Psicopedagogo', ['psicopedagogo', 'psicopedagoga']],
  ['psiquiatra', 'Psiquiatría', M, ['psiquiatra', 'psiquiatria']],
  ['quimico-farmaceutico', 'Química y farmacia', 'Químico farmacéutico', ['quimico farmaceutico', 'quimica farmaceutica']],
  ['quiropractico', 'Quiropraxia', 'Quiropráctico', ['quiropractico', 'quiropractica']],
  ['radiologo', 'Radiología', M, ['radiologo', 'radiologa', 'radiologia']],
  ['radioterapeuta', 'Radioterapia', M, ['radioterapeuta']],
  ['reumatologo', 'Reumatología', M, ['reumatologo', 'reumatologa', 'reumatologia']],
  ['tecnologo-medico', 'Tecnología médica', 'Tecnólogo médico', ['tecnologo medico', 'tecnologa medica']],
  ['terapeuta-ocupacional', 'Terapia ocupacional', 'Terapeuta ocupacional', ['terapeuta ocupacional', 'terapia ocupacional']],
  ['traumatologo', 'Traumatología', M, ['traumatologo', 'traumatologa', 'traumatologia']],
  ['urologo', 'Urología', M, ['urologo', 'urologa', 'urologia']],
  ['sexologo', 'Sexología', 'Sexólogo', ['sexologo', 'sexologa', 'sexologia']],
  ['medico-del-deporte', 'Medicina del deporte', M, ['medico deportivo', 'medicina deportiva', 'medicina del deporte']],
];

export const DOCTORALIA_SPECIALTIES: SpecialtyInfo[] = rows.map(([slug, name, profession, aliases]) => ({slug, name, profession, aliases: aliases ?? []}));
const bySlug = new Map(DOCTORALIA_SPECIALTIES.map(s => [s.slug, s]));

export const GENERIC_PROFESSION = 'Profesional de la salud';

/** Traduce la ruta de Doctoralia. Si es desconocida, usa el texto visible (p. ej. "Cardióloga") y la profesión genérica. */
export function specialtyFromSlug(slug: string, label?: string | null): SpecialtyInfo {
  const known = bySlug.get(slug);
  if (known) return known;
  const text = (label ?? slug.replace(/-/g, ' ')).trim();
  const name = text ? text.charAt(0).toUpperCase() + text.slice(1) : slug;
  return {slug, name, profession: GENERIC_PROFESSION, aliases: []};
}
