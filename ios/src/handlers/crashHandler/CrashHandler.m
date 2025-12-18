//
//  crashHandler.mm
//  apptileSeed
//
//  Created by Vadivazhagan on 12/03/25.
//

#import "CrashHandler.h"
#import "apptileSeed-Swift.h"

#include <signal.h>
#include <execinfo.h>

@implementation CrashHandler

void handleSignal(int signal) {
  // Get signal name
  NSString *signalName;
  switch (signal) {
    case SIGABRT: signalName = @"SIGABRT (Abort - usually assertion failure or abort() call)"; break;
    case SIGILL: signalName = @"SIGILL (Illegal Instruction)"; break;
    case SIGSEGV: signalName = @"SIGSEGV (Segmentation Fault - invalid memory access)"; break;
    case SIGFPE: signalName = @"SIGFPE (Floating Point Exception)"; break;
    case SIGBUS: signalName = @"SIGBUS (Bus Error - alignment issue)"; break;
    case SIGPIPE: signalName = @"SIGPIPE (Broken Pipe)"; break;
    default: signalName = [NSString stringWithFormat:@"Signal %d (Unknown)", signal]; break;
  }

  [Logger error:@""];
  [Logger error:@"========================================"];
  [Logger error:@"❌❌❌ NATIVE CRASH DETECTED ❌❌❌"];
  [Logger error:@"========================================"];
  [Logger error:[NSString stringWithFormat:@"Signal: %d - %@", signal, signalName]];
  [Logger error:@""];

  // Print detailed stack trace
  void* callstack[128];
  int frames = backtrace(callstack, 128);
  char** symbols = backtrace_symbols(callstack, frames);

  [Logger error:[NSString stringWithFormat:@"Stack Trace (%d frames):", frames]];
  [Logger error:@"----------------------------------------"];
  for (int i = 0; i < frames; i++) {
    NSString *frame = [NSString stringWithFormat:@"%2d: %s", i, symbols[i]];
    [Logger error:frame];
  }
  free(symbols);

  [Logger error:@"----------------------------------------"];
  [Logger error:@""];

  // Mark bundle as broken before crashing
  [Logger warn:@"Marking bundle as broken..."];
  [BundleTrackerPrefs markCurrentBundleBroken];

  // Restore default handler
  struct sigaction defaultAction;
  sigemptyset(&defaultAction.sa_mask);
  defaultAction.sa_flags = 0;
  defaultAction.sa_handler = SIG_DFL;
  sigaction(signal, &defaultAction, NULL);

  [Logger error:@"Re-raising signal to crash..."];
  [Logger error:@"========================================"];

  // Re-raise the signal to let the system handle it
  raise(signal);
}

+ (void) setupSignalHandlers {
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
