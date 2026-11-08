// Generated from smk762/argus-survey@local schema/survey-wire.schema.json.
// Do not edit: change schema/pins.json and run `npm run wire:pull`.

export interface SurveyWire {
  AccuracyBody?: AccuracyBody;
  AccuracyGroup?: AccuracyGroup;
  AccuracyReport?: AccuracyReport;
  Bounds3D?: Bounds3D;
  ChangeBody?: ChangeBody;
  ChangeReport?: ChangeReport;
  CheckResidual?: CheckResidual;
  ClassCount?: ClassCount;
  CloudSummary?: CloudSummary;
  CommandEvent?: CommandEvent;
  CommandRecord?: CommandRecord;
  ContoursBody?: ContoursBody;
  ContoursReport?: ContoursReport;
  CrsRecord?: CrsRecord;
  CrsRef?: CrsRef;
  CutfillBody?: CutfillBody;
  DensityStats?: DensityStats;
  DimStats?: DimStats;
  DoctorCheck?: DoctorCheck;
  DoctorReport?: DoctorReport;
  DoneEvent?: DoneEvent;
  EmptyBody?: EmptyBody;
  ErrorEvent?: ErrorEvent;
  FileRef?: FileRef;
  GapStats?: GapStats;
  GridSpec?: GridSpec;
  GroundBody?: GroundBody;
  GroundReport?: GroundReport;
  HealthInfo?: HealthInfo;
  IngestBody?: IngestBody;
  IngestRecord?: IngestRecord;
  InputRecord?: InputRecord;
  JobDigest?: JobDigest;
  JobSidecar?: JobSidecar;
  OperationCandidate?: OperationCandidate;
  OutlierStats?: OutlierStats;
  Product?: Product;
  ProfileBody?: ProfileBody;
  ProfileReport?: ProfileReport;
  QaBody?: QaBody;
  QaReport?: QaReport;
  RasterStats?: RasterStats;
  RasterView?: RasterView;
  RunBody?: RunBody;
  StartEvent?: StartEvent;
  StepEvent?: StepEvent;
  SurfaceRecord?: SurfaceRecord;
  SurfacesBody?: SurfacesBody;
  SurfacesReport?: SurfacesReport;
  ToolVersions?: ToolVersions;
  TransformOp?: TransformOp;
  ValueCount?: ValueCount;
  VolumeBody?: VolumeBody;
  VolumeReport?: VolumeReport;
  WarningEvent?: WarningEvent;
  ZoneVolume?: ZoneVolume;
}
export interface AccuracyBody {
  checkpoint_rmse?: number | null;
  checks: string;
  class_cm?: number | null;
  /**
   * @minItems 4
   * @maxItems 4
   */
  cols?: [string, string, string, string];
  crs: string;
  surface?: string;
}
export interface AccuracyGroup {
  excluded: number;
  group: "NVA" | "VVA";
  max_abs_m: number | null;
  mean_m: number | null;
  meets_minimum_count: boolean;
  n: number;
  pass_fail_applies: boolean;
  rmse_data_m: number | null;
  rmse_m: number | null;
  std_m: number | null;
}
export interface AccuracyReport {
  checkpoint_rmse_m: number | null;
  checks_crs: string;
  checks_file: FileRef;
  groups: AccuracyGroup[];
  notes?: string[];
  residuals: CheckResidual[];
  sampling: string;
  standard: string;
  statement: string;
  surface: string;
  target_class_cm?: number | null;
  transform: TransformOp | null;
}
/**
 * A file pinned by digest. ``path`` is relative to the job dir for products, absolute for inputs.
 */
export interface FileRef {
  path: string;
  sha256: string;
  size: number;
}
export interface CheckResidual {
  description?: string;
  excluded?: string | null;
  group: "NVA" | "VVA";
  id: string;
  residual: number | null;
  x: number;
  y: number;
  z_check: number;
  z_surface: number | null;
}
/**
 * The exact coordinate operation a job used (fed verbatim to PDAL's filters.projpipeline).
 */
export interface TransformOp {
  accuracy_m: number | null;
  candidates?: OperationCandidate[];
  chosen_by?: "proj-default" | "user";
  grids?: string[];
  name: string;
  proj: string;
  source: string;
  target: string;
}
/**
 * One candidate PROJ offered for a transformation, and why it was or wasn't used.
 */
export interface OperationCandidate {
  accuracy_m: number | null;
  grids?: string[];
  missing_grids?: string[];
  name: string;
}
export interface Bounds3D {
  maxx: number;
  maxy: number;
  maxz: number;
  minx: number;
  miny: number;
  minz: number;
}
export interface ChangeBody {
  against: string;
  lod?: number | null;
  lod_from_accuracy?: boolean;
  polygon?: string | null;
  polygon_srs?: string | null;
  surface?: string;
}
export interface ChangeReport {
  against_job: string;
  against_sidecar_sha256: string;
  area?: string;
  compared_area_m2: number;
  gain_area_m2: number;
  gain_m3: number;
  lod_m: number;
  lod_rule: string;
  loss_area_m2: number;
  loss_m3: number;
  net_m3: number;
  no_change_area_m2: number;
  res: number;
  surface: string;
  this_sidecar_sha256: string;
  void_percent: number;
}
export interface ClassCount {
  code: number;
  count: number;
  name: string;
  percent: number;
}
/**
 * Header-level facts about a point cloud (``pdal info --summary``).
 */
export interface CloudSummary {
  bounds: Bounds3D;
  copc?: boolean;
  count: number;
  dimensions?: string[];
  las_version?: string | null;
  point_format?: number | null;
  scale?: [unknown, unknown, unknown] | null;
}
/**
 * SSE ``command``: one tool invocation finished; ``index`` is its 1-based place in ``job.json`` ``commands``.
 */
export interface CommandEvent {
  index: number;
  returncode: number;
  seconds: number;
  step: string;
  tool: string;
}
/**
 * One external command, as run. ``argv`` is exact; ``pipeline`` is the PDAL JSON fed on stdin.
 */
export interface CommandRecord {
  argv: string[];
  pipeline?:
    | {
        [k: string]: unknown;
      }[]
    | null;
  returncode: number;
  seconds: number;
  started_at: string;
  step: string;
  tool: string;
}
export interface ContoursBody {
  index?: number | null;
  interval?: number;
}
export interface ContoursReport {
  features: number;
  index_every: number | null;
  interval: number;
  max_elev: number | null;
  min_elev: number | null;
  source: string;
}
/**
 * Everything a surveyor needs to know about the coordinates of a dataset (CLAUDE.md rule 1).
 */
export interface CrsRecord {
  definition: string;
  epoch?: number | null;
  geoid?: string | null;
  height_reference?: "gravity" | "ellipsoidal" | "none";
  horizontal: CrsRef;
  name: string;
  source?: "file" | "user" | "transformed";
  vertical?: CrsRef | null;
  vertical_assumed?: string | null;
}
/**
 * One CRS (or one component of a compound CRS), as identified.
 */
export interface CrsRef {
  epsg?: number | null;
  kind: string;
  name: string;
  north_first?: boolean;
  unit_factor?: number;
  units?: string;
}
export interface CutfillBody {
  allow_voids?: boolean;
  design: string;
  design_vertical?: string | null;
  name?: string | null;
  polygon?: string | null;
  polygon_geojson?: {
    [k: string]: unknown;
  } | null;
  polygon_srs?: string | null;
  resample?: boolean;
  surface?: string;
}
export interface DensityStats {
  covered_cells: number;
  mean: number;
  p5: number;
  p50: number;
  p95: number;
  res: number;
}
export interface DimStats {
  average: number;
  count: number;
  counts?: {
    [k: string]: number;
  };
  maximum: number;
  minimum: number;
  name: string;
  stddev: number;
}
export interface DoctorCheck {
  detail?: string;
  name: string;
  ok: boolean;
  required?: boolean;
}
export interface DoctorReport {
  checks?: DoctorCheck[];
  versions: ToolVersions;
}
/**
 * Versions of the external stack a job ran against (``doctor`` and every sidecar).
 */
export interface ToolVersions {
  gdal?: string | null;
  pdal?: string | null;
  proj?: string | null;
}
/**
 * SSE ``done``: the step's own report in ``result``; the job's product kinds and warnings after it.
 */
export interface DoneEvent {
  job: string;
  products: string[];
  result: {
    [k: string]: unknown;
  };
  step: string;
  warnings: string[];
}
export interface EmptyBody {}
/**
 * SSE ``error``: a refusal or tool failure; ``stderr`` is the tool's stderr tail when a command failed.
 */
export interface ErrorEvent {
  message: string;
  stderr?: string | null;
}
export interface GapStats {
  area_m2: number;
  cells: number;
  percent_of_coverage: number;
  threshold: number;
  threshold_rule: string;
}
/**
 * A raster grid snapped to multiples of its resolution, so two epochs at the same res share cells.
 *
 * ``origin_x``/``origin_y`` are the lower-left corner (PDAL writers.gdal's convention); the
 * GeoTIFF's top-left is ``(origin_x, origin_y + height * res)``.
 */
export interface GridSpec {
  height: number;
  origin_x: number;
  origin_y: number;
  res: number;
  width: number;
}
export interface GroundBody {
  keep_classes?: boolean;
  method?: string;
  params?: {
    [k: string]: number | boolean;
  };
}
export interface GroundReport {
  ground_density: number;
  ground_percent: number;
  ground_points: number;
  ground_spacing: number;
  method: "smrf" | "csf";
  noise_points: number;
  normalised_returns: boolean;
  outlier_params: {
    [k: string]: unknown;
  };
  params: {
    [k: string]: unknown;
  };
  points: number;
  reset_classes: boolean;
  tile_buffer: number;
  tile_size: number;
  tiles: number;
}
/**
 * ``GET /health``. ``read_only`` is true unless ``SURVEY_ALLOW_PROCESS`` is set: clients disable writes on it.
 */
export interface HealthInfo {
  read_only: boolean;
  service?: "argus-survey";
  status?: "ok";
  tools: ToolVersions;
  version: string;
}
export interface IngestBody {
  assume_vertical?: string | null;
  crop?: string | null;
  crop_srs?: string | null;
  force?: boolean;
  /**
   * @minItems 1
   */
  inputs: [string, ...string[]];
  operation?: string | null;
  s_srs?: string | null;
  t_srs?: string | null;
}
export interface IngestRecord {
  crop?: string | null;
  cropped?: boolean;
  inputs_count: number;
  output_count: number;
  scale: number;
  source_crs: CrsRecord;
  source_type?: "lidar" | "photogrammetry" | "unknown";
  stats?: DimStats[];
  transform?: TransformOp | null;
}
/**
 * An input file, pinned. ``path`` is absolute.
 */
export interface InputRecord {
  path: string;
  role?: string;
  sha256: string;
  size: number;
  summary?: CloudSummary | null;
}
/**
 * One row of ``GET /jobs``.
 */
export interface JobDigest {
  created_at: string;
  crs: string | null;
  job_id: string;
  points: number | null;
  products: string[];
  steps_done: string[];
  updated_at: string;
  warnings: number;
}
/**
 * ``job.json`` — the API contract and the provenance record of a job.
 */
export interface JobSidecar {
  accuracy?: AccuracyReport | null;
  change?: ChangeReport | null;
  commands?: CommandRecord[];
  contours?: ContoursReport | null;
  created_at?: string;
  crs?: CrsRecord | null;
  ground?: GroundReport | null;
  ingest?: IngestRecord | null;
  inputs?: InputRecord[];
  job_id: string;
  package_version: string;
  products?: {
    [k: string]: Product;
  };
  profiles?: ProfileReport[];
  qa?: QaReport | null;
  schema_version?: number;
  steps_done?: string[];
  surfaces?: SurfacesReport | null;
  timings?: {
    [k: string]: number;
  };
  tools?: ToolVersions;
  updated_at?: string;
  volumes?: VolumeReport[];
  warnings?: string[];
}
/**
 * A job output. ``path`` is relative to the job dir.
 */
export interface Product {
  description?: string;
  kind: string;
  meta?: {
    [k: string]: unknown;
  };
  path: string;
  sha256: string;
  size: number;
  step: string;
}
export interface ProfileReport {
  length_m: number;
  line: string;
  samples: number;
  step_m: number;
  surfaces: string[];
}
export interface QaReport {
  bounds: Bounds3D;
  classes: ClassCount[];
  coverage_area_m2: number;
  coverage_hex_edge: number;
  density: DensityStats;
  gaps: GapStats;
  outliers: OutlierStats;
  points: number;
  returns: ValueCount[];
  source_type: "lidar" | "photogrammetry" | "unknown";
  tiles?: number;
}
export interface OutlierStats {
  count: number;
  method: string;
  params: {
    [k: string]: unknown;
  };
  percent: number;
}
export interface ValueCount {
  count: number;
  percent: number;
  value: number;
}
export interface SurfacesReport {
  grid: GridSpec;
  resolution_warning?: string | null;
  surfaces?: {
    [k: string]: SurfaceRecord;
  };
}
export interface SurfaceRecord {
  filled_max_distance?: number | null;
  kind: "dtm" | "dsm" | "chm";
  method: string;
  output_type: string;
  points_used: string;
  radius: number | null;
  stats: RasterStats;
  void_percent: number;
  void_percent_after_fill?: number | null;
  window_size: number;
}
export interface RasterStats {
  maximum?: number | null;
  mean?: number | null;
  minimum?: number | null;
  stddev?: number | null;
  total_cells: number;
  valid_cells: number;
}
export interface VolumeReport {
  allow_voids?: boolean;
  kind: "stockpile" | "cutfill" | "change";
  method: string;
  res: number;
  resampled?: string | null;
  sign_convention: string;
  surface: string;
  surface_void_percent: {
    [k: string]: number;
  };
  zones: ZoneVolume[];
}
/**
 * Volumes between an upper and a lower surface over one polygon (all positive numbers).
 */
export interface ZoneVolume {
  above_m3: number;
  area_above_m2: number;
  area_below_m2: number;
  area_m2: number;
  base: string;
  base_fit_rms_m?: number | null;
  below_m3: number;
  boundary_samples?: number | null;
  name: string;
  net_m3: number;
  void_percent: number;
}
export interface ProfileBody {
  line?: {
    [k: string]: unknown;
  } | null;
  line_file?: string | null;
  line_srs?: string | null;
  step?: number;
}
export interface QaBody {
  density_res?: number;
  min_density?: number | null;
}
/**
 * ``GET /jobs/{id}/web/{kind}`` for a raster: a Web Mercator PNG placed by its lon/lat corners (TL, TR, BR, BL).
 *
 * ``ramp`` names the fixed colour ramp (``terrain``: blue → red over ``range``; ``diverging``: blue (−) → white (0)
 * → red (+) for a DoD; ``hillshade``: grey, no ``range``). A derived view, never a deliverable.
 */
export interface RasterView {
  coordinates: number[][];
  kind: string;
  png: string;
  ramp?: ("terrain" | "diverging" | "hillshade") | null;
  range?: number[] | null;
  url: string;
}
export interface RunBody {
  assume_vertical?: string | null;
  crop?: string | null;
  crop_srs?: string | null;
  fill_voids?: number | null;
  force?: boolean;
  /**
   * @minItems 1
   */
  inputs: [string, ...string[]];
  interval?: number;
  method?: string;
  operation?: string | null;
  res?: number;
  s_srs?: string | null;
  t_srs?: string | null;
}
/**
 * SSE ``start``: the step was accepted and is running.
 */
export interface StartEvent {
  job: string;
  step: string;
}
/**
 * SSE ``step``: a (sub-)step started or finished (``run`` reports each of its steps).
 */
export interface StepEvent {
  seconds?: number | null;
  state: "start" | "done";
  step: string;
}
export interface SurfacesBody {
  chm?: boolean;
  dsm?: boolean;
  dsm_method?: string;
  dtm?: boolean;
  fill_voids?: number | null;
  res?: number;
}
export interface VolumeBody {
  allow_voids?: boolean;
  base?: string;
  base_vertical?: string | null;
  name?: string | null;
  polygon?: string | null;
  polygon_geojson?: {
    [k: string]: unknown;
  } | null;
  polygon_srs?: string | null;
  resample?: boolean;
  surface?: string;
}
/**
 * SSE ``warning``: also appended to ``job.json`` ``warnings``.
 */
export interface WarningEvent {
  message: string;
}
