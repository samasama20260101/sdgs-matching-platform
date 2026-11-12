// このファイルは scripts/fetch-world-counts.ts が作る。手で直さない(対応表は worldCountSources.ts)。
// 取得: 2026-11-12  国連 SDG データベース(unstats.un.org/sdgapi)・世界銀行
import type { WorldCount, WorldPopulation } from '@/lib/domain/worldCount'

export const WORLD_POPULATION: WorldPopulation = {"value":8215424893,"year":2025,"source":"World Bank (SP.POP.TOTL)"}

export const WORLD_COUNTS: Record<string, WorldCount> = {
  "1.1.1": {
    "value": 846653342,
    "year": 2024,
    "series": "SI_POV_DAY1",
    "source": "Poverty and Inequality Portal, World Bank",
    "method": "share"
  },
  "2.1.1": {
    "value": 644600000,
    "year": 2025,
    "series": "SN_ITK_DEFCN",
    "source": "Food and Agriculture Organization of the United Nations (FAO)",
    "method": "count"
  },
  "2.1.2": {
    "value": 2119579622,
    "year": 2025,
    "series": "AG_PRD_FIESMS",
    "source": "Food and Agriculture Organization of the United Nations (FAO)",
    "method": "share"
  },
  "3.3.5": {
    "value": 1409526996,
    "year": 2024,
    "series": "SH_TRP_INTVN",
    "source": "WHO Global Health Observatory",
    "method": "count"
  },
  "6.1.1": {
    "value": 2138192399,
    "year": 2024,
    "series": "SH_H2O_SAFE",
    "source": "WHO/UNICEF Joint Monitoring Programme for Water Supply, Sanitation and Hygiene (2025)",
    "method": "lacking"
  },
  "6.2.1": {
    "value": 3378864076,
    "year": 2024,
    "series": "SH_SAN_SAFE",
    "source": "WHO/UNICEF Joint Monitoring Programme for Water Supply, Sanitation and Hygiene (2025)",
    "method": "lacking"
  },
  "7.1.1": {
    "value": 659412699,
    "year": 2024,
    "series": "EG_ACS_ELEC",
    "source": "World Bank",
    "method": "lacking"
  },
  "7.1.2": {
    "value": 2035224381,
    "year": 2024,
    "series": "EG_EGY_CLEAN",
    "source": "Global Health Observatory (GHO), World Health Organisation (WHO).",
    "method": "lacking"
  },
  "9.c.1": {
    "value": 156093073,
    "year": 2025,
    "series": "IT_MOB_2GNTWK",
    "source": "Data based on the ITU DataHub",
    "method": "lacking"
  }
}
