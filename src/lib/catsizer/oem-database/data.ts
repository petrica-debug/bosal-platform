import type {
  AmDesignGuidanceRow,
  EcsComponentRecord,
  OemDatabaseManifest,
  OemReferenceRow,
} from "./types";

import manifestJson from "./data/manifest.json";
import ecsJson from "./data/ecs-components.json";
import washcoatJson from "./data/washcoat-chemistry.json";
import amGuidanceJson from "./data/am-design-guidance.json";
import ptPdJson from "./data/pt-pd-substitution.json";
import architectureJson from "./data/system-architecture.json";
import sourceTraceabilityJson from "./data/source-traceability.json";

export const OEM_DB_MANIFEST = manifestJson as OemDatabaseManifest;

export const ECS_COMPONENTS = ecsJson as EcsComponentRecord[];

export const WASHCOAT_CHEMISTRY = washcoatJson as OemReferenceRow[];

export const AM_DESIGN_GUIDANCE = amGuidanceJson as AmDesignGuidanceRow[];

export const PT_PD_SUBSTITUTION = ptPdJson as OemReferenceRow[];

export const SYSTEM_ARCHITECTURE = architectureJson as OemReferenceRow[];

export const SOURCE_TRACEABILITY = sourceTraceabilityJson as OemReferenceRow[];
