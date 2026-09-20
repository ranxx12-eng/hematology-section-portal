export const FORM_HEMA_022_CODE = 'Form-Hema-022';
export const FORM_HEMA_022_TITLE = 'New Reagent Lot to Lot Verification';
export const FORM_HEMA_022_QID = 'HEMA-022';

export const FORM_HEMA_022_SAMPLE_COUNT = 3;

export type FormHema022Layout = 'alinity_hq' | 'stago_sta_r_max';

export type FormHema022TestCode =
  | 'WBC'
  | 'RBC'
  | 'HGB'
  | 'PLT'
  | 'PT'
  | 'PTT'
  | 'FIB'
  | 'D_DIMER'
  | 'RETIC'
  | 'R_PERCENT';

export interface FormHema022TestDefinition {
  code: FormHema022TestCode;
  /** Controlled label on Form-Hema-022 (PTT, not APTT). */
  label: string;
  unit?: string;
  acceptanceLimitPercent?: number;
  /** When false, automatic Pass/Fail is not offered until controlled criteria exist. */
  autoInterpretationEnabled: boolean;
}

export interface FormHema022ReagentDefinition {
  key: string;
  displayName: string;
  aliases: string[];
  layout: FormHema022Layout;
  analyteTestGroup: string;
  instrumentHint: string;
  tests: FormHema022TestDefinition[];
}

/** Controlled reagent → test mapping for Form-Hema-022. */
export const FORM_HEMA_022_REAGENTS: FormHema022ReagentDefinition[] = [
  {
    key: 'neoptimal',
    displayName: 'NeoPTimal',
    aliases: ['Neo PTimal', 'Neo-PTimal'],
    layout: 'stago_sta_r_max',
    analyteTestGroup: 'Coagulation',
    instrumentHint: 'Stago STA-R MAX',
    tests: [{ code: 'PT', label: 'PT', unit: 'seconds', acceptanceLimitPercent: 15, autoInterpretationEnabled: true }],
  },
  {
    key: 'ptt_a',
    displayName: 'PTT A',
    aliases: ['PTT-A', 'APTT A'],
    layout: 'stago_sta_r_max',
    analyteTestGroup: 'Coagulation',
    instrumentHint: 'Stago STA-R MAX',
    tests: [{ code: 'PTT', label: 'PTT', unit: 'seconds', acceptanceLimitPercent: 15, autoInterpretationEnabled: true }],
  },
  {
    key: 'fib_liquid',
    displayName: 'FIB LIQUID',
    aliases: ['FIB Liquid', 'Fibrinogen Liquid'],
    layout: 'stago_sta_r_max',
    analyteTestGroup: 'Coagulation',
    instrumentHint: 'Stago STA-R MAX',
    tests: [{ code: 'FIB', label: 'Fibrinogen (FIB)', unit: 'g/L', acceptanceLimitPercent: 20, autoInterpretationEnabled: true }],
  },
  {
    key: 'd_di_plus',
    displayName: 'D-DI PLUS',
    aliases: ['D-DI Plus', 'DDI PLUS', 'D-Dimer Plus'],
    layout: 'stago_sta_r_max',
    analyteTestGroup: 'Coagulation',
    instrumentHint: 'Stago STA-R MAX',
    tests: [{ code: 'D_DIMER', label: 'D-Dimer', unit: 'ng/mL', acceptanceLimitPercent: 15, autoInterpretationEnabled: true }],
  },
  {
    key: 'wbc_reagent',
    displayName: 'WBC reagent',
    aliases: ['WBC Reagent', 'WBC Reagents'],
    layout: 'alinity_hq',
    analyteTestGroup: 'CBC',
    instrumentHint: 'ALINITY HQ',
    tests: [
      { code: 'WBC', label: 'WBC', unit: '×10³/µL', acceptanceLimitPercent: 15, autoInterpretationEnabled: true },
      { code: 'RBC', label: 'RBC', unit: '×10⁶/µL', acceptanceLimitPercent: 6, autoInterpretationEnabled: true },
      { code: 'HGB', label: 'HGB', unit: 'g/dL', acceptanceLimitPercent: 7, autoInterpretationEnabled: true },
      { code: 'PLT', label: 'PLT', unit: '×10³/µL', acceptanceLimitPercent: 25, autoInterpretationEnabled: true },
    ],
  },
  {
    key: 'hgb_reagent',
    displayName: 'HGB reagent',
    aliases: ['HGB Reagent', 'Hgb reagent'],
    layout: 'alinity_hq',
    analyteTestGroup: 'CBC',
    instrumentHint: 'ALINITY HQ',
    tests: [
      { code: 'WBC', label: 'WBC', unit: '×10³/µL', acceptanceLimitPercent: 15, autoInterpretationEnabled: true },
      { code: 'RBC', label: 'RBC', unit: '×10⁶/µL', acceptanceLimitPercent: 6, autoInterpretationEnabled: true },
      { code: 'HGB', label: 'HGB', unit: 'g/dL', acceptanceLimitPercent: 7, autoInterpretationEnabled: true },
      { code: 'PLT', label: 'PLT', unit: '×10³/µL', acceptanceLimitPercent: 25, autoInterpretationEnabled: true },
    ],
  },
  {
    key: 'diluent_reagent',
    displayName: 'Diluent reagent',
    aliases: ['Diluent Reagent', 'Diluent'],
    layout: 'alinity_hq',
    analyteTestGroup: 'CBC',
    instrumentHint: 'ALINITY HQ',
    tests: [
      { code: 'WBC', label: 'WBC', unit: '×10³/µL', acceptanceLimitPercent: 15, autoInterpretationEnabled: true },
      { code: 'RBC', label: 'RBC', unit: '×10⁶/µL', acceptanceLimitPercent: 6, autoInterpretationEnabled: true },
      { code: 'HGB', label: 'HGB', unit: 'g/dL', acceptanceLimitPercent: 7, autoInterpretationEnabled: true },
      { code: 'PLT', label: 'PLT', unit: '×10³/µL', acceptanceLimitPercent: 25, autoInterpretationEnabled: true },
    ],
  },
  {
    key: 'retic_reagent',
    displayName: 'RETIC reagent',
    aliases: ['RETIC Reagent', 'Retic reagent'],
    layout: 'alinity_hq',
    analyteTestGroup: 'CBC / Reticulocyte',
    instrumentHint: 'ALINITY HQ',
    tests: [
      { code: 'RETIC', label: 'RETIC', autoInterpretationEnabled: false },
      { code: 'R_PERCENT', label: 'R%', autoInterpretationEnabled: false },
    ],
  },
];

/** Maps application APTT naming to controlled Form-Hema-022 PTT label only in display/PDF. */
export const APTT_TO_FORM_HEMA_022_PTT = 'PTT';
