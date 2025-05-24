//
//  CrashHandler.mm
//  apptileSeed
//
//  Created by Mohammed Aman Khan on 23/05/25.
//

#import "CrashHandler.h"
#import "apptileSeed-Swift.h"

#include <execinfo.h>
#include <signal.h>

@implementation CrashHandler

void handleSignal(int signal) {
  [Logger warn:[NSString stringWithFormat:@"⚠️ Caught Signal: %d", signal]];

  // Mark bundle as broken before crashing
  [BundleTrackerPrefs markCurrentBundleBroken];

  // Restore default handler
  struct sigaction defaultAction;
  sigemptyset(&defaultAction.sa_mask);
  defaultAction.sa_flags = 0;
  defaultAction.sa_handler = SIG_DFL;
  sigaction(signal, &defaultAction, NULL);

  // Re-raise the signal to let the system handle it
  raise(signal);
}

+ (void)setupSignalHandlers {
  int signals[] = {SIGABRT, SIGILL, SIGSEGV, SIGFPE, SIGBUS, SIGPIPE};
  for (int i = 0; i < sizeof(signals) / sizeof(signals[0]); i++) {
    struct sigaction action;
    sigemptyset(&action.sa_mask);
    action.sa_flags = 0;
    action.sa_handler = handleSignal;
    sigaction(signals[i], &action, NULL);
  }
}

@end
