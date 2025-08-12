You will be building out a react native application to display information about an investment portfolio.

## App Overview

The main purpose of the app is to display a portfolio's current holdings, the performance of each asset, and the percent allocated to everything relative to the target allocations. The app will load data from an API and render it across two tabs. There are only 13 assets in this portfolio.

The portfolio tab will show the total value of the portfolio, a chart showing the value vs cost across time, and the holdings for each asset.

The allocations tab will show bar charts for each asset, displaying the desired vs actual allocation for each.

The color scheme and design of this app is inspired by Delta by Toro.

## Execution Strategy

Below I've listed the high level tasks that must be accomplished to build this app. Start by putting them all in a TODO.md (along with any changes you feel would make sense).

You will work down the list from each bullet point. For each high level bullet point, you will work without confirmation until it's done (including any sub-bullets); however, check in with me before moving onto a subsequent bullet point so we can ensure it's up to standards before moving on.

IMPORTANT: When you think you've completed a bullet point, do a scan over the current code to make sure that it satisfies all the required details. Then try to run the code with a simulator and make sure it builds and runs fine. One then, should you check in with me to see if the task can be considered complete.

## Tasks

Create the TODO.md from the following:

- Scaffold the react-native application inside `/frontend/mobile`
  - This is in an existing monorepo, so ensure the react app's home directory is under `/frontend/mobile`
  - Ensure all packages are up to date
- Create the two tabs: "Portfolio" and "Allocations".
  - Portfolio should have an upwards line chart or pie chart (which ever you think is best) as the tab icon, and "Allocations" should have a bar chart as the icon.
  - Create the two screens PortfolioScreen and AllocationsScreen which will house everything in the respective tabs
  - Each screen should have a header component that just displays the Tab name and is pinned to the top. And then below that component, the rest of the screen should be contained in a single scroll view
- Define a file with the app styling and coloring
  - The following colors will be used, feel free to rename to the standardized naming for a color scheme
    - Screen Background: #000000
    - Main Text: #F5F5F5
    - Sub Text: ##999999
    - Component Background: #171717
    - Selected Element Background: #242424
    - Red: #FF3249
    - Red Highlight Background: #48070F
    - Green: #34D86C
    - Green Highlight Background: #00351D
  - Fonts:
    - The font should be: Roobertpro
    - Install it if you need to
- Setup some mock data to represent the API request
  - The assets can be found in assets.yaml
  - There will be two API requests: positions and performance
  - Positions:
    - The API response will return a list of JSON objects, one for each asset
    - Example schema:
    ```
        [{
            "asset": "VB",
            "category": "Stock ETFs",
            "description": "Small Cap",
            "current_price": "239.8148",
            "average_price": "208.532356",
            "quantity": "18.990000",
            "cost": "3941.530000",
            "value": "4532.5990520000",
            "returns": "15.00124218578131276082813400",
            "current_allocation": "11.24783769471934041352527319",
            "target_allocation": "10"
        },
        ...
        ]
    ```
  - Performance:
    - The API response will return a list of dates with the cost/value/return for each
    - Example schema:
    ```
    [
        {
            "date": "2025-08-02",
            "cost": "297711.539204",
            "value": "392105.833244",
            "returns": "31.70662927355277159141364217"
        },
        {
            "date": "2025-08-03",
            "cost": "297711.539204",
            "value": "391635.239327",
            "returns": "31.54855884126175571710911022"
        },
    ]
    ```
- Add the category selector component
- The category selector component should be the first component at the top of the main screen that's scrollable (below the tab header)
  - It should consist of two toggleable buttons: "Crypto" and "Stocks"
  - The button should consist of an outline, the word in the middle, and the background color should match the main app background color of #000000
  - When the button is toggled on, the word and outline should be of color: main text (pending renaming)
  - When the button is toggled off, the word and outline should be of color: sub text (pending renaming)
  - The two buttons should line horizontally with Stocks on the left and Crypto on the right
  - Both buttons should be on the left side of the page
- Add the summary component
  - The summary component is meant to display the total worth of the portfolio
  - It consists of a few pieces:
    - On top, in small text, it says "Total Worth" in the subtext color
    - Below that, in large and bolded text, should be the total value of the portfolio (sum of the value of each position)
      - This text should be formatted with commas and two decimals of precision
    - To the right of the total value should be the string "USD". The USD should be slightly large than the "Total Worth" text, but still much smaller than the total value number.
    - The total value number and "USD" should have the bottom of their letters aligned, but the top of the USD should only make it up to ~40% of the height of the total value number
    - Below the total value should display the gains/losses in dollars and as a percent
      - The dollar amount is calculated from the difference between total value and total cost. If it's negative, it should be red, if it's positive it should be green. It should always have a sign (+ or -). It should be formatted to two decimals places with commas and two decimals of precision
      - To the right of the gains/losses in dollars should be the percent gain/loss. The percent text should be bolded in either red/green, and should have a red/green highlight background color, respectively, behind it. It should have a sign, two decimals of precision, and end with a percentage symbol
- Add the total worth chart component
  - The total worth chart will be a simple line chart
  - There should be no grid lines and no y-axis. Only two horizontal lines filling the full width and intersecting at the highest and lowest point of the chart respectively. The min/max values of the chart should be above the top line and below the bottom line respectively. and should be in subtext color formatted with a leading dollar sign, commas, and two decimals of precision. There should be no x axis labels.
  - The line should be smooth with no points symbols, and the color should be green or red depending on whether the total return is positive or negative
  - As a finger holds and pans across the plot, a vertical line should appear that will snap to each point with a circular symbol. As a point is selected like this, the values in the summary component should change to whatever it is as the selected value. Additionally, when it's selected like this, the date should appear in small subtext color underneath the gains/losses numbers.
  - Use whatever plotting will make this most aesthetic and smooth
  - Below the plot, there should be a few selectable durations: "1W", "1M", "YTD", "1Y", "ALL". Only one can be selected at a time. When it's selected, the text should be white, the background should be Selected Element Background color (pending renaming), and there should be no outline. When it is not selected, it should have subtext color for the text and the main background color as the background. Each of these options should be lined up horizontally and evenly spaced across the width of the page
- Add the asset list component
  - Create a component for each asset. Each of these components will be stacked vertically
  - The component will have background color: Component Background (pending renaming)
  - At the far left end of the component should be the asset logo. This can be found using the image path defined in assets.yaml
  - Then to the right of the image there should be the asset name (ticker) in main text color and bolded, and underneath the name it should show "{quantity} | {price}" in subtext color
  - On the right side of the main component, should show the total value in bold main text color, with the gains/losses in dollars and returns underneath (with returns to the right of dollars). The gains/losses/returns should follow the same pattern as the summary where the return has a highlighted background.
- Integrate with the actual API endpoint
  - The endpoints are https://portfolio-backend-production-29dc.up.railway.app/positions and https://portfolio-backend-production-29dc.up.railway.app/performance/{granularity} where granularity is either "1W", "1M", "YTD", "1Y", "ALL"
  - It needs an auth bearer token which can be found from the FASTAPI_SECRET env variable
  - The granularity passed to peformance should be chosen based on what has selected under the chart
- Allocations tab to be spec'd and completed later

## Coding Rules

- Always prefer simple solutions
- Avoid duplication of code whenever possible, which means checking for other areas of the codebase that might already have similar code and functionality
- You are careful to only make changes that are requested or you are confident are well understood and related to the change being requested
- When fixing an issue or bug, do not introduce a new pattern or technology without first exhausting all options for the existing implementation. And if you finally do this, make sure to remove the old implementation afterwards so we don’t have duplicate logic.
- Keep the codebase very clean and organized
- Avoid writing scripts in files if possible, especially if the script is likely only to be run once
- Avoid having files over 200-300 lines of code. Refactor at that point.
- Mocking data is only needed for tests, never mock data for dev or prod
- Never add stubbing or fake data patterns to code that affects the dev or prod environments
- Never overwrite my .env file without first asking and confirming
- Focus on the areas of code relevant to the task
- Do not touch code that is unrelated to the task
- Write thorough tests for all major functionality
- Avoid making major changes to the patterns and architecture of how a feature works, after it has show to work well, unless explicitly instructed to do so
- Always think about what other methods and areas of code might be affected by code changes
- If there is a function that has a lot of transformations/calculations, make sure to write a unit test for it and confirm the test passes
