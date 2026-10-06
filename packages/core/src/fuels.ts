// Catálogo de combustibles. Extensible: añadir una entrada aquí lo habilita en ingesta, API y UI.
// `mitecoField` = columna exacta del servicio REST de MITECO (verificado 02/10/2026).

export type FuelUnit = 'L' | 'kg' | 'kWh';
export type FuelFamily = 'gasoline' | 'diesel' | 'gas' | 'hydrogen' | 'additive' | 'other';

export interface FuelType {
  code: string;
  name: string;
  short: string;
  family: FuelFamily;
  unit: FuelUnit;
  mitecoField: string;
  mitecoProductId: number;
  /** Aparece en el selector principal. */
  primary: boolean;
  /** Se puede buscar (el Gasóleo B es agrícola y no se ofrece). */
  searchable: boolean;
}

export const FUELS: readonly FuelType[] = [
  { code: 'g95', name: 'Gasolina 95', short: '95', family: 'gasoline', unit: 'L', mitecoField: 'Precio Gasolina 95 E5', mitecoProductId: 1, primary: true, searchable: true },
  { code: 'g98', name: 'Gasolina 98', short: '98', family: 'gasoline', unit: 'L', mitecoField: 'Precio Gasolina 98 E5', mitecoProductId: 3, primary: true, searchable: true },
  { code: 'diesel', name: 'Diésel', short: 'Diésel', family: 'diesel', unit: 'L', mitecoField: 'Precio Gasoleo A', mitecoProductId: 4, primary: true, searchable: true },
  { code: 'glp', name: 'GLP', short: 'GLP', family: 'gas', unit: 'L', mitecoField: 'Precio Gases licuados del petróleo', mitecoProductId: 17, primary: true, searchable: true },
  { code: 'diesel-premium', name: 'Diésel Premium', short: 'Diésel+', family: 'diesel', unit: 'L', mitecoField: 'Precio Gasoleo Premium', mitecoProductId: 5, primary: false, searchable: true },
  { code: 'g95-premium', name: 'Gasolina 95 Premium', short: '95+', family: 'gasoline', unit: 'L', mitecoField: 'Precio Gasolina 95 E5 Premium', mitecoProductId: 20, primary: false, searchable: true },
  { code: 'g95-e10', name: 'Gasolina 95 E10', short: '95 E10', family: 'gasoline', unit: 'L', mitecoField: 'Precio Gasolina 95 E10', mitecoProductId: 23, primary: false, searchable: true },
  { code: 'g98-e10', name: 'Gasolina 98 E10', short: '98 E10', family: 'gasoline', unit: 'L', mitecoField: 'Precio Gasolina 98 E10', mitecoProductId: 21, primary: false, searchable: true },
  { code: 'hvo', name: 'Diésel renovable', short: 'HVO', family: 'diesel', unit: 'L', mitecoField: 'Precio Diésel Renovable', mitecoProductId: 27, primary: false, searchable: true },
  { code: 'gasolina-renovable', name: 'Gasolina renovable', short: 'Renovable', family: 'gasoline', unit: 'L', mitecoField: 'Precio Gasolina Renovable', mitecoProductId: 28, primary: false, searchable: true },
  { code: 'gnc', name: 'Gas natural comprimido', short: 'GNC', family: 'gas', unit: 'kg', mitecoField: 'Precio Gas Natural Comprimido', mitecoProductId: 18, primary: false, searchable: true },
  { code: 'gnl', name: 'Gas natural licuado', short: 'GNL', family: 'gas', unit: 'kg', mitecoField: 'Precio Gas Natural Licuado', mitecoProductId: 19, primary: false, searchable: true },
  { code: 'adblue', name: 'AdBlue', short: 'AdBlue', family: 'additive', unit: 'L', mitecoField: 'Precio Adblue', mitecoProductId: 26, primary: false, searchable: true },
  { code: 'h2', name: 'Hidrógeno', short: 'H₂', family: 'hydrogen', unit: 'kg', mitecoField: 'Precio Hidrogeno', mitecoProductId: 22, primary: false, searchable: true },
  { code: 'gasoleo-b', name: 'Gasóleo B (agrícola)', short: 'Gasóleo B', family: 'diesel', unit: 'L', mitecoField: 'Precio Gasoleo B', mitecoProductId: 6, primary: false, searchable: false },
] as const;

export const PRIMARY_FUELS = FUELS.filter((f) => f.primary);
export const DEFAULT_FUEL = 'g95';

const byCode = new Map(FUELS.map((f) => [f.code, f]));
export const getFuel = (code: string): FuelType | undefined => byCode.get(code);
export const isFuelCode = (code: string | null | undefined): code is string => !!code && byCode.has(code);
