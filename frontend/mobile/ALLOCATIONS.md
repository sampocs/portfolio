# Allocations Tab - Detailed Specification

## Overview

The Allocations tab displays portfolio allocation data in two different views: **Categories** and **Assets**. Users can toggle between these views to see allocation breakdowns at different levels of granularity.

## Design Principles

- Follow existing app design system (dark theme, consistent spacing)
- Match styling patterns from Portfolio tab components
- Ensure consistent user interactions (touch, scrolling, visual feedback)
- Use data from existing API positions endpoint
- Maintain 50% allocation as the visual baseline for scaling

## Components Architecture

### 1. GroupingSection Component

**File:** `src/components/GroupingSection.tsx`

**Purpose:** Toggle between "Categories" and "Assets" views (similar to existing CategorySelector)

**Design Specs:**
- Two toggle buttons horizontally aligned
- "Categories" on left, "Assets" on right
- Only one can be selected at a time
- Uses same styling pattern as `CategorySelector.tsx`

**Styling:**
- Background: `theme.colors.background`
- Border: `theme.colors.muted` (unselected) / `theme.colors.foreground` (selected)
- Text: `theme.colors.muted` (unselected) / `theme.colors.foreground` (selected)
- Border radius: 20px
- Padding: 8px horizontal, 4px vertical

**State:**
```typescript
type GroupingType = 'categories' | 'assets';
const [selectedGrouping, setSelectedGrouping] = useState<GroupingType>('categories');
```

### 2. Category Chart View

**Components:**
- `CategoryDonutChart.tsx` - Main dual donut chart
- `CategoryLegend.tsx` - Legend and data display

#### 2.1 CategoryDonutChart Component

**Purpose:** Displays dual donut charts showing current vs target allocations by category

**Data Processing:**
```typescript
// Aggregate assets by category
const categoryData = positions.reduce((acc, asset) => {
  const category = asset.category;
  if (!acc[category]) {
    acc[category] = {
      category,
      currentValue: 0,
      currentAllocation: 0,
      targetAllocation: 0,
      assets: []
    };
  }
  acc[category].currentValue += parseFloat(asset.value);
  acc[category].currentAllocation += parseFloat(asset.current_allocation);
  acc[category].targetAllocation += parseFloat(asset.target_allocation);
  acc[category].assets.push(asset);
  return acc;
}, {});
```

**Chart Design:**
- Dual concentric donut charts
- Inner donut: Target allocations
- Outer donut: Current allocations
- Colors: Use consistent color palette from theme
- Center text: "Current vs Target" label
- Size: Approximately 200x200px
- Stroke width: 12px inner, 16px outer

**Chart Library:** Use `react-native-svg` + manual path calculation or `victory-native` pie charts

**Colors by Category:**
```typescript
const categoryColors = {
  'Stock ETFs': theme.colors.success,
  'Crypto Stocks': '#8B5CF6', // Purple
  'Crypto Tokens': '#F59E0B', // Orange
  'Gold': '#EF4444', // Red
  'Real Estate': '#06B6D4', // Cyan
};
```

#### 2.2 CategoryLegend Component

**Purpose:** Display category breakdown with percentages and dollar values

**Layout:**
- List of categories below the donut chart
- Each row shows: Color indicator | Category name | Current% | Target% | Current$ | Target$ | Delta

**Row Design:**
```
[Ï] Stock ETFs     45.2% ’ 46.0%    $45,231 ’ $46,000    +$769 (+0.8%)
```

**Styling:**
- Color indicator: 8px circle with category color
- Category name: `theme.colors.foreground`, medium weight
- Percentages: `theme.colors.muted`, small size
- Dollar values: `theme.colors.foreground`, small size
- Deltas: Green/red based on positive/negative, with background highlight

### 3. Asset Chart View

**Components:**
- `AssetAllocationList.tsx` - Container for all asset rows
- `AssetAllocationRow.tsx` - Individual asset allocation display

#### 3.1 AssetAllocationRow Component

**Purpose:** Shows individual asset allocation with bullet-style horizontal bar chart

**Layout Structure:**
```
[LOGO] Asset Description    |ˆˆˆˆˆˆˆˆˆˆˆˆ‘‘‘‘‘‘‘‘‘|  12.5% ’ 13.0%
       Additional Info       Current: $5,234      Target: $5,200
                            Delta: -$34 (-0.5%)
```

**Left Section (Fixed Width ~80px):**
- Asset logo (40x40px) - from `assets/images/{asset}.png`
- Asset description below logo (`asset.description`)
- Styling: Logo with 8px border radius, description in `theme.colors.muted`

**Chart Section (Flexible Width):**
- Horizontal bar representing allocation
- **Scaling Rule:** 50% allocation = full available width
- Bar height: 6px
- Current allocation: Solid bar (`theme.colors.success` if on target, `theme.colors.destructive` if significantly off)
- Target allocation: Vertical tick mark at target position
- Background: `theme.colors.card` with subtle border

**Right Section (Data Display):**
- Top row: Current% ’ Target% (e.g., "12.5% ’ 13.0%")
- Middle row: Current: $X,XXX | Target: $X,XXX
- Bottom row: Delta: ±$XXX (±X.X%) with color coding

**Bar Scaling Logic:**
```typescript
// Calculate bar width as percentage of available space
const maxDisplayAllocation = 50; // 50% = full width
const barWidth = Math.min(currentAllocation / maxDisplayAllocation, 1) * 100;
const targetPosition = Math.min(targetAllocation / maxDisplayAllocation, 1) * 100;
```

**Color Logic:**
- Green bar: Current allocation within ±0.5% of target
- Red bar: Current allocation >1% away from target
- Yellow/orange bar: Current allocation 0.5-1% away from target

#### 3.2 AssetAllocationList Component

**Purpose:** Container that renders all asset rows with proper spacing

**Features:**
- Scrollable list of AssetAllocationRow components
- Sort options: By allocation size, by delta, alphabetical
- Optional category filtering (reuse existing logic)

## Data Management

### API Integration
- Use existing `apiService.getPositions()` for asset data
- Calculate category aggregations in the component
- No additional API calls needed

### Data Types (Extend Existing)
```typescript
export interface CategoryAllocation {
  category: string;
  currentValue: number;
  currentAllocation: number;
  targetAllocation: number;
  assets: Asset[];
}

export interface AllocationDelta {
  dollarDelta: number;
  percentageDelta: number;
  isOverAllocated: boolean;
}
```

## AllocationsScreen Integration

**File:** `src/screens/AllocationsScreen.tsx`

**Structure:**
1. Header (existing)
2. GroupingSection (new)
3. Conditional rendering:
   - If "categories": CategoryDonutChart + CategoryLegend
   - If "assets": AssetAllocationList
4. Loading states and error handling

**State Management:**
```typescript
const [groupingType, setGroupingType] = useState<'categories' | 'assets'>('categories');
const [positions, setPositions] = useState<Asset[]>([]);
const [isLoading, setIsLoading] = useState(true);

// Use existing API service pattern from PortfolioScreen
useEffect(() => {
  const fetchPositions = async () => {
    try {
      const data = await apiService.getPositions();
      setPositions(data);
    } catch (error) {
      console.error('Error fetching positions:', error);
    } finally {
      setIsLoading(false);
    }
  };
  fetchPositions();
}, []);
```

## Visual Specifications

### Spacing & Layout
- Container padding: `theme.spacing.xl` (20px)
- Component margins: `theme.spacing.lg` (16px)
- Row padding: `theme.spacing.md` (12px)
- Logo size: 40x40px with 8px border radius

### Typography
- Section headers: `getTextStyle('xl', 'bold')`
- Asset names: `getTextStyle('md', 'semibold')`
- Descriptions: `getTextStyle('sm', 'normal')` with `theme.colors.muted`
- Data values: `getTextStyle('sm', 'medium')`
- Deltas: `getTextStyle('xs', 'medium')` with color coding

### Colors & Theming
- Follow existing `theme.colors` from `src/styles/theme.ts`
- Success/error states: Use existing `success`/`destructive` colors
- Card backgrounds: `theme.colors.card`
- Borders: `theme.colors.border`

## Performance Considerations

- Memoize category calculations with `useMemo`
- Optimize chart rendering for smooth scrolling
- Use `React.memo` for individual asset rows
- Lazy load asset images if needed

## Testing Strategy

1. Test category aggregation logic with mock data
2. Verify bar scaling calculations across different allocation values
3. Test toggle between categories/assets views
4. Validate color coding for over/under allocation
5. Test with empty/loading states

## Future Enhancements

- Add rebalancing suggestions
- Interactive chart tooltips
- Export allocation data
- Historical allocation tracking
- Custom allocation targets