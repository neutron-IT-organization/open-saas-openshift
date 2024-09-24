import React from 'react'
import { Route, Switch, BrowserRouter as Router } from 'react-router-dom'
import App from '../../../../src/client/App'

import createAuthRequiredPage from "./auth/pages/createAuthRequiredPage"

import LandingPage from '../../../../src/landing-page/LandingPage'
import LoginPage from '../../../../src/auth/LoginPage'
import { Signup as SignupPage } from '../../../../src/auth/SignupPage'
import { RequestPasswordResetPage } from '../../../../src/auth/email-and-pass/RequestPasswordResetPage'
import { PasswordResetPage } from '../../../../src/auth/email-and-pass/PasswordResetPage'
import { EmailVerificationPage } from '../../../../src/auth/email-and-pass/EmailVerificationPage'
import AccountPage from '../../../../src/user/AccountPage'
import DemoAppPage from '../../../../src/demo-ai-app/DemoAppPage'
import PricingPage from '../../../../src/payment/PricingPage'
import CheckoutPage from '../../../../src/payment/CheckoutPage'
import FileUploadPage from '../../../../src/file-upload/FileUploadPage'
import AnalyticsDashboardPage from '../../../../src/admin/dashboards/analytics/AnalyticsDashboardPage'
import AdminUsersPage from '../../../../src/admin/dashboards/users/UsersDashboardPage'
import AdminSettingsPage from '../../../../src/admin/elements/settings/SettingsPage'
import AdminChartsPage from '../../../../src/admin/elements/charts/ChartsPage'
import AdminFormElementsPage from '../../../../src/admin/elements/forms/FormElementsPage'
import AdminFormLayoutsPage from '../../../../src/admin/elements/forms/FormLayoutsPage'
import AdminCalendarPage from '../../../../src/admin/elements/calendar/CalendarPage'
import AdminUIAlertsPage from '../../../../src/admin/elements/ui-elements/AlertsPage'
import AdminUIButtonsPage from '../../../../src/admin/elements/ui-elements/ButtonsPage'
import AdminMessagesPage from '../../../../src/messages/MessagesPage'


import { routes } from 'wasp/client/router'

export const routeNameToRouteComponent = {
  LandingPageRoute: LandingPage,
  LoginRoute: LoginPage,
  SignupRoute: SignupPage,
  RequestPasswordResetRoute: RequestPasswordResetPage,
  PasswordResetRoute: PasswordResetPage,
  EmailVerificationRoute: EmailVerificationPage,
  AccountRoute: createAuthRequiredPage(AccountPage),
  DemoAppRoute: createAuthRequiredPage(DemoAppPage),
  PricingPageRoute: PricingPage,
  CheckoutRoute: createAuthRequiredPage(CheckoutPage),
  FileUploadRoute: createAuthRequiredPage(FileUploadPage),
  AdminRoute: createAuthRequiredPage(AnalyticsDashboardPage),
  AdminUsersRoute: createAuthRequiredPage(AdminUsersPage),
  AdminSettingsRoute: createAuthRequiredPage(AdminSettingsPage),
  AdminChartsRoute: createAuthRequiredPage(AdminChartsPage),
  AdminFormElementsRoute: createAuthRequiredPage(AdminFormElementsPage),
  AdminFormLayoutsRoute: createAuthRequiredPage(AdminFormLayoutsPage),
  AdminCalendarRoute: createAuthRequiredPage(AdminCalendarPage),
  AdminUIAlertsRoute: createAuthRequiredPage(AdminUIAlertsPage),
  AdminUIButtonsRoute: createAuthRequiredPage(AdminUIButtonsPage),
  AdminMessagesRoute: createAuthRequiredPage(AdminMessagesPage),
} as const;

const router = (
  <Router basename="/">
    <App>
    <Switch>
      {Object.entries(routes).map(([routeKey, route]) => (
        <Route
          exact
          key={routeKey}
          path={route.to}
          component={routeNameToRouteComponent[routeKey]}
        />
      ))}
    </Switch>
    </App>
  </Router>
)

export default router
