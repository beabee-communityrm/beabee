import { Response } from "express";
import { ContentType, Controller, Get, Res } from "routing-controllers";

import OptionsService from "@core/services/OptionsService";

interface Theme {
  primaryColor: string;
  secondaryColor: string;
  primaryTextColor: string;
  secondaryTextColor: string;
  bodyFont: string;
  headingFont: string;
  successColor: string;
  dangerColor: string;
  warningColor: string;
}

@Controller()
export class ThemeController {
  @Get("/theme.css")
  @ContentType("text/css")
  getThemeCSS(): string {
    const theme = OptionsService.getJSON("theme") as Theme;

    return `
:root {
  --primary-color: ${theme.primaryColor};
  --secondary-color: ${theme.secondaryColor};
  --primary-text-color: ${theme.primaryTextColor};
  --secondary-text-color: ${theme.secondaryTextColor};
  --body-font: ${theme.bodyFont};
  --heading-font: ${theme.headingFont};
  --success-color: ${theme.successColor};
  --danger-color: ${theme.dangerColor};
  --warning-color: ${theme.warningColor};
}
`;
  }
}
