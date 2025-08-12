## Prompt

I need to add a line chart in my react native application.

I want the plot to look exactly like the chart that's in Delta by Toro where it looks slick and professional.

Some important features of the chart:

- If the chart is not being clicked on, the line should be smooth with no point symbols
- It should be styled with a gradient under the line
- It should support a pan gesture where you can click and hold on the chart and it will snap to a point. When it snaps, the symbol should appear for the point that it's snapping to and a vertical line should appear cutting through the point
- There should be no grid lines or traditional x/y axes and labels
- Instead there should only be two horizontal lines - one that intersects the max point in the plot, and the other that intersects the min point
- Above the top line, the y-value for that line should be labeled directly above that line. Directly the bottom line, the y-value for that bottom line should be labeled.
- The chart should plot the total value field from the performance data

I've attached a screenshot from Delta

First: give a break down of the different charting library options available in react native that could be used for this and gain an understanding of what comes out of the box, vs what would have to be custom, vs what would not be possible (making the package a nonstarter). For instance, if a plot looks bad (like a matplotlib chart) that would be a non-starter unless the coloring could be customized.

Then once you've decided, build out a detailed spec for an LLM agent to build the chart with that package

## Response

React Native Chart Library Analysis for Delta-Style Chart
Library Breakdown & Capabilities

1. Victory Native (Recommended)

Has built-in pan/zoom gestures via useChartTransformState hook with support for snap-to-point interactions NearformNearform
Supports gradient fills using react-native-svg with Defs, LinearGradient, and Stop components Creating Victory charts in React Native - LogRocket Blog
Recently rewritten with TypeScript, improved performance, and actively maintained by Nearform React Native ECharts VS Victory Native VS React Native Chart Kit: Which Solution is Better? | HackerNoon
Pros: Advanced gesture handling, SVG-based rendering, compositional architecture, excellent documentation
Customization: Can hide axes/grids, create custom overlays, supports smooth curves
Cons: More complex setup, requires understanding of composable components

2. React Native Gifted Charts

Supports gradient effects, smooth animations, and press event handling npmGitHub
Over 75+ example configurations, actively maintained as of 2025 React Native: Crafting Stunning Charts with react-native-gifted-charts | by Andrew Chester | Medium
Pros: Easy to use, built-in gradient support, good documentation
Customization: Good gradient support, can hide axes
Cons: Limited gesture customization for snap-to-point behavior

3. React Native Chart Kit

Simple configuration-based approach but lacks advanced customization options like custom gesture handling ITNEXTRopstam
Limited chart types, and the library hasn't been updated in 3 years React Native charting libraries | Awesome React Native
Status: Not recommended due to lack of maintenance

4. React Native SVG Charts

Uses D3.js for SVG path generation and supports decorators for chart enhancements React Native ECharts VS Victory Native VS React Native Chart Kit, Which solution is better? - DEV Community
Pros: Highly customizable, D3-based
Cons: More manual work required, limited built-in gesture support

5. React Native Charts Wrapper

Wraps native charting libraries like MPAndroidChart and iOS Charts for optimal performance React Native ECharts VS Victory Native VS React Native Chart Kit, Which solution is better? - DEV Community
Pros: Native performance, extensive chart types
Cons: Platform-specific implementations, complex setup

Recommendation: Victory Native
Victory Native is the best choice for achieving the Delta-style chart because:

Built-in pan/zoom gestures that can be customized for snap-to-point behavior
SVG-based rendering allows for smooth lines, gradients, and custom overlays
Compositional architecture enables custom implementations like crosshair lines
Active maintenance and performance improvements
Extensive customization for hiding axes and creating minimal designs

## Spec

### Overview

Create a professional financial chart similar to Delta by Toro using Victory Native, featuring smooth curves, gradient fills, custom pan gestures with snap-to-point functionality, and minimal axis design.

### Dependencies Required

```bash
npm install victory-native react-native-svg react-native-reanimated react-native-gesture-handler @shopify/react-native-skia
```

### Core Components & Architecture

#### 1. Main Chart Component Structure

```javascript
import {
  CartesianChart,
  useChartTransformState,
  Line,
  Area,
} from "victory-native";
import { View, Text, Dimensions } from "react-native";
import { Defs, LinearGradient, Stop } from "react-native-svg";
```

#### 2. Data Structure

Use the mock performance data.

### Implementation Requirements

#### 1. Chart Configuration

- **Container**: Use `CartesianChart` as the main container
- **Transform State**: Implement `useChartTransformState` for pan/zoom functionality
- **Data Keys**: Set `xKey="date"` and `yKeys={["value"]}`
- **Dimensions**: Full width, height around 300-400px

#### 2. Visual Styling Requirements

##### Line Styling

- **Smooth Curves**: Enable smooth/bezier curves (no angular segments)
- **No Point Symbols**: Hide all data point dots by default
- **Line Color**: If the total portfolio return is positive, use the "success" color, otherwise use "destructive" color
- **Line Width**: 2-3px thickness

##### Gradient Fill

```javascript
// Implement gradient under the curve using react-native-svg
<Defs>
  <LinearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
    <Stop
      offset="0%"
      stopColor="{DETERMINE_BASED_ON_COLOR_SCHEME}"
      stopOpacity="0.4"
    />
    <Stop
      offset="100%"
      stopColor="{DETERMINE_BASED_ON_COLOR_SCHEME}"
      stopOpacity="0.0"
    />
  </LinearGradient>
</Defs>
```

##### Minimal Axis Design

- **No Grid Lines**: Completely hide all grid lines
- **No Traditional Axes**: Remove x and y axis lines
- **Only Two Horizontal Lines**:
  - One at the maximum data value
  - One at the minimum data value
- **Line Styling**: Thin, subtle dotted/dashed lines

#### 3. Interactive Gesture Implementation

##### Pan Gesture Configuration

```javascript
const transformState = useChartTransformState({
  scaleX: 1.0,
  scaleY: 1.0,
});

// Custom chart press configuration
const chartPressConfig = {
  activateAfterLongPress: 0, // Immediate activation
  activeOffsetX: 5, // Minimal offset for precision
};
```

##### Snap-to-Point Functionality

- **Trigger**: Single finger touch and hold
- **Behavior**: Snap to nearest data point horizontally
- **Visual Feedback**:
  - Show point symbol at snapped location
  - Display vertical crosshair line through the point
  - Update value labels

##### Crosshair Implementation

- **Vertical Line**: Full height line at snapped x-position
- **Point Indicator**: Small circle at the data point
- **Styling**: Semi-transparent, contrasting color

#### 4. Label System

##### Min/Max Value Labels

- **Position**:
  - Max label: Directly above the top horizontal line
  - Min label: Directly below the bottom horizontal line
- **Content**: Display the actual y-values formatted as currency
- **Styling**: Small, subtle text color

##### Summary Component Updates

- **No active gestures**: The summary component should display the total worth
- **Pan gesture active**: Summary component should display the total value at the selected point

#### 5. Performance Optimizations

##### Data Handling

- **Large Datasets**: Implement data sampling for >1000 points
- **Smooth Updates**: Use Victory Native's built-in animation system
- **Memory Management**: Virtualize data points outside viewport

##### Rendering Optimizations

- **SVG Performance**: Leverage Skia rendering for smooth performance
- **Gesture Debouncing**: Limit update frequency during pan operations

### Component Architecture

#### Main Chart Component

```javascript
const DeltaStyleChart = ({ data, width, height }) => {
  // Transform state for gestures
  const transformState = useChartTransformState();

  // State for crosshair position and visibility
  const [crosshairVisible, setCrosshairVisible] = useState(false);
  const [crosshairData, setCrosshairData] = useState(null);

  // Calculate min/max values
  const maxValue = Math.max(...data.map((d) => d.value));
  const minValue = Math.min(...data.map((d) => d.value));

  return (
    <View style={{ width, height }}>
      {/* Value Labels */}
      <Text style={styles.maxLabel}>${maxValue.toFixed(2)}</Text>

      {/* Main Chart */}
      <CartesianChart
        data={data}
        xKey="date"
        yKeys={["value"]}
        transformState={transformState}
        chartPressConfig={chartPressConfig}
        onChartBoundsChange={handleBoundsChange}
      >
        {/* Gradient Definition */}
        <Defs>
          <LinearGradient id="areaGradient">
            {/* Gradient stops */}
          </LinearGradient>
        </Defs>

        {/* Area with gradient fill */}
        <Area curveType="natural" fill="url(#areaGradient)" />

        {/* Main line */}
        <Line
          curveType="natural"
          strokeWidth={2.5}
          color="{DETERMINE_BASED_ON_SCHEME}"
        />

        {/* Min/Max Horizontal Lines */}
        <HorizontalLine value={maxValue} />
        <HorizontalLine value={minValue} />

        {/* Crosshair (conditional) */}
        {crosshairVisible && <CrosshairOverlay data={crosshairData} />}
      </CartesianChart>

      <Text style={styles.minLabel}>${minValue.toFixed(2)}</Text>
    </View>
  );
};
```

#### Custom Components Needed

##### HorizontalLine Component

- Draws dotted horizontal lines at specified y-values
- Uses SVG Line with dashed stroke pattern

##### CrosshairOverlay Component

- Vertical line at touch position
- Point indicator at data intersection
- Handles touch position calculation

##### Gesture Handler Integration

- Custom pan gesture recognizer
- Coordinate translation from screen to data space
- Nearest point calculation algorithm

### Styling Requirements

#### Color Scheme

- **Primary Line**: "success" or "destructive"
- **Gradient**: Fade from primary color to transparent
- **Crosshair**: "accent"
- **Text**: "accent"
- **Background**: "background"

#### Typography

- **Value Labels**: Small, medium weight, same font as rest of app

#### Layout

- **Full Width**: Use Dimensions.get('window').width
- **Responsive Height**: Scale based on content area
- **Padding**: Minimal internal padding for clean look

### Error Handling & Edge Cases

#### Data Validation

- **Empty Data**: Show placeholder state
- **Single Point**: Disable gestures, show static view
- **Invalid Values**: Filter out null/undefined points

#### Gesture Edge Cases

- **Chart Boundaries**: Prevent pan beyond data range
- **Rapid Gestures**: Debounce updates to prevent lag
- **Touch Outside**: Hide crosshair when touch ends

#### Performance Safeguards

- **Large Datasets**: Implement data chunking
- **Memory Leaks**: Proper cleanup of gesture handlers
- **Background State**: Pause animations when app backgrounded

### Testing Requirements

#### Visual Testing

- **Pixel Perfect**: Verify gradient smoothness
- **Line Quality**: Ensure smooth curves at all zoom levels
- **Responsiveness**: Test on various screen sizes

#### Accessibility

- **Screen Readers**: Provide data point descriptions
- **Touch Targets**: Ensure adequate touch area
- **High Contrast**: Support accessibility themes

### Final Implementation Notes

1. **Start with Basic Chart**: Implement core line chart first
2. **Add Gestures**: Implement pan and snap functionality
3. **Visual Polish**: Add gradients, crosshairs, and styling
4. **Performance**: Optimize for large datasets
5. **Testing**: Validate on multiple devices and scenarios

This specification provides a comprehensive roadmap for creating a Delta-style chart that matches the professional appearance and functionality shown in your screenshot.
