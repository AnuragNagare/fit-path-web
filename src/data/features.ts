import type { LucideIcon } from 'lucide-react';
import {
  Accessibility, Apple, Bike, Boxes, Cable, ChevronUp,
  Clock, CloudFog, CreditCard, DoorOpen, Droplets, Dumbbell,
  Flame, Footprints, Gift, GlassWater, HeartPulse, LayoutGrid,
  Leaf, Lock, MonitorPlay, Moon, Music2, ParkingCircle,
  ShieldAlert, ShowerHead, SquareStack, StretchHorizontal,
  Sun, Swords, Target, Ticket, Timer, UserCheck, Users,
  Waves, Wind, Zap,
} from 'lucide-react';

export interface Feature { id: string; label: string; Icon: LucideIcon; }
export interface FeatureCategory { title: string; features: Feature[]; }

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    title: 'Access & Membership',
    features: [
      { id: '24x7',          label: '24×7 Access',           Icon: Clock       },
      { id: 'early_morning', label: 'Early Morning Access',  Icon: Sun         },
      { id: 'late_night',    label: 'Late Night Access',     Icon: Moon        },
      { id: 'day_pass',      label: 'Day Pass',              Icon: Ticket      },
      { id: 'hourly_pass',   label: 'Hourly Pass',           Icon: Timer       },
      { id: 'free_trial',    label: 'Free Trial',            Icon: Gift        },
      { id: 'monthly',       label: 'Monthly Membership',    Icon: CreditCard  },
    ],
  },
  {
    title: 'Training & Classes',
    features: [
      { id: 'pt',      label: 'Personal Training',        Icon: UserCheck       },
      { id: 'group',   label: 'Group Classes',            Icon: Users           },
      { id: 'yoga',    label: 'Yoga',                     Icon: Leaf            },
      { id: 'zumba',   label: 'Zumba / Dance Fitness',    Icon: Music2          },
      { id: 'hiit',    label: 'HIIT / Functional Training', Icon: Zap           },
      { id: 'boxing',  label: 'Boxing / Combat Area',     Icon: Target          },
    ],
  },
  {
    title: 'Cardio',
    features: [
      { id: 'treadmill',    label: 'Treadmills',                  Icon: MonitorPlay       },
      { id: 'cross_trainer',label: 'Cross Trainer / Elliptical',  Icon: StretchHorizontal },
      { id: 'spin',         label: 'Spin / Exercise Bikes',       Icon: Bike              },
      { id: 'rowing',       label: 'Rowing Machine',              Icon: Waves             },
    ],
  },
  {
    title: 'Strength Training',
    features: [
      { id: 'free_weights', label: 'Dumbbells & Free Weights',              Icon: Dumbbell          },
      { id: 'squat_rack',   label: 'Squat Rack / Power Rack',               Icon: SquareStack       },
      { id: 'smith',        label: 'Smith Machine',                          Icon: Boxes             },
      { id: 'cable',        label: 'Cable Crossover / Functional Trainer',  Icon: Cable             },
      { id: 'leg_press',    label: 'Leg Press',                              Icon: Footprints        },
      { id: 'hack_squat',   label: 'Hack Squat',                             Icon: ChevronUp         },
      { id: 'chest_press',  label: 'Chest Press',                            Icon: LayoutGrid        },
      { id: 'lat_pulldown', label: 'Lat Pulldown / Seated Row',              Icon: Swords            },
    ],
  },
  {
    title: 'Functional',
    features: [
      { id: 'functional_area', label: 'Functional Training Area', Icon: LayoutGrid        },
      { id: 'calisthenics',    label: 'Calisthenics Area',        Icon: StretchHorizontal },
    ],
  },
  {
    title: 'Recovery & Wellness',
    features: [
      { id: 'pool',      label: 'Swimming Pool',               Icon: Droplets  },
      { id: 'sauna',     label: 'Sauna',                       Icon: Flame     },
      { id: 'steam',     label: 'Steam Room',                  Icon: CloudFog  },
      { id: 'nutrition', label: 'Nutrition / Diet Consultation',Icon: Apple     },
      { id: 'physio',    label: 'Physiotherapy / Recovery',    Icon: HeartPulse},
    ],
  },
  {
    title: 'Hygiene & Convenience',
    features: [
      { id: 'shower',   label: 'Shower',            Icon: ShowerHead   },
      { id: 'lockers',  label: 'Lockers',            Icon: Lock         },
      { id: 'changing', label: 'Changing Room',      Icon: DoorOpen     },
      { id: 'parking',  label: 'Parking',            Icon: ParkingCircle},
      { id: 'ac',       label: 'Air Conditioning',   Icon: Wind         },
      { id: 'water',    label: 'Drinking Water',     Icon: GlassWater   },
    ],
  },
  {
    title: 'Inclusivity & Accessibility',
    features: [
      { id: 'women_only',  label: 'Women-only Area / Timings', Icon: ShieldAlert  },
      { id: 'wheelchair',  label: 'Wheelchair Accessible',     Icon: Accessibility},
    ],
  },
];

// Features OpenStreetMap tags can actually confirm (kept in sync with featuresFromTags in
// api/_lib/geo.ts). The filter only lets users pick these; the rest have no data to match.
export const SUPPORTED_FEATURE_IDS = new Set([
  '24x7', 'pool', 'sauna', 'steam', 'shower', 'lockers', 'changing', 'ac', 'water',
  'wheelchair', 'women_only', 'parking', 'yoga', 'zumba', 'boxing', 'free_weights', 'hiit',
]);

export const FEATURE_LABELS: Record<string, string> = Object.fromEntries(
  FEATURE_CATEGORIES.flatMap(c => c.features).map(f => [f.id, f.label]),
);
