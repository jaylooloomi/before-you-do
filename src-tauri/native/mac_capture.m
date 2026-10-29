// Independent Apple SDK bridge. No ShareX source or runtime dependencies.
#import <Foundation/Foundation.h>
#import <AppKit/AppKit.h>
#import <CoreGraphics/CoreGraphics.h>
#import <CoreVideo/CoreVideo.h>
#import <ScreenCaptureKit/ScreenCaptureKit.h>
#include <stdatomic.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

typedef struct {
    int32_t x, y;
    uint32_t width, height;
    double logical_x, logical_y, logical_width, logical_height;
    uint8_t *pixels;
    size_t length;
} BYDImage;
// 0 ready, 1 unsupported OS, 2 permission, 3 target gone, 4 bounds,
// 5 size limit, 6 timeout, 7 native failure. No user content appears in diagnostics.
static const uint64_t maxPixels = 64000000;
static _Atomic int32_t lastApplication;
static id activationObserver;
static int32_t excludedPID;

int byd_capture_status(void) {
    @autoreleasepool {
        if (@available(macOS 14.0, *)) return CGPreflightScreenCaptureAccess() ? 0 : 2;
        return 1;
    }
}
int byd_capture_request(void) {
    @autoreleasepool {
        if (@available(macOS 14.0, *)) { CGRequestScreenCaptureAccess(); return byd_capture_status(); }
        return 1;
    }
}
void byd_capture_track(int32_t ownPID) {
    @autoreleasepool {
        excludedPID = ownPID;
        NSRunningApplication *front = NSWorkspace.sharedWorkspace.frontmostApplication;
        if (front && front.processIdentifier != ownPID) atomic_store(&lastApplication, front.processIdentifier);
        if (!activationObserver) {
            activationObserver = [NSWorkspace.sharedWorkspace.notificationCenter
                addObserverForName:NSWorkspaceDidActivateApplicationNotification object:nil
                queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *note) {
                    NSRunningApplication *app = note.userInfo[NSWorkspaceApplicationKey];
                    if (app && app.processIdentifier > 0 && app.processIdentifier != excludedPID)
                        atomic_store(&lastApplication, app.processIdentifier);
                }];
        }
    }
}
uint64_t byd_capture_target(void) {
    @autoreleasepool {
        NSRunningApplication *front = NSWorkspace.sharedWorkspace.frontmostApplication;
        int32_t pid = front && front.processIdentifier != excludedPID ? front.processIdentifier : atomic_load(&lastApplication);
        if (pid <= 0 || pid == excludedPID) return 0;
        NSArray *list = CFBridgingRelease(CGWindowListCopyWindowInfo(kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements, kCGNullWindowID));
        for (NSDictionary *info in list) {
            if ([info[(id)kCGWindowOwnerPID] intValue] == pid && [info[(id)kCGWindowLayer] intValue] == 0)
                return [info[(id)kCGWindowNumber] unsignedLongLongValue];
        }
        return 0;
    }
}
@interface BYDAsyncResult : NSObject
@property(nonatomic,strong) id value;
@property(nonatomic,strong) NSError *error;
@property(nonatomic,strong) dispatch_semaphore_t gate;
@property(nonatomic,assign) CGImageRef image;
@end
@implementation BYDAsyncResult
- (instancetype)init { if ((self = [super init])) _gate = dispatch_semaphore_create(0); return self; }
- (void)dealloc { if (_image) CGImageRelease(_image); }
@end

static BOOL dimensions(uint32_t width, uint32_t height) {
    return width && height && (uint64_t)width * height <= maxPixels;
}
static uint8_t *imageRGBA(CGImageRef image, uint32_t width, uint32_t height) {
    if (!image || !dimensions(width,height)) return NULL;
    size_t count = (size_t)width * height * 4;
    uint8_t *pixels = calloc(1,count);
    if (!pixels) return NULL;
    CGColorSpaceRef color = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
    CGContextRef context = CGBitmapContextCreate(pixels,width,height,8,(size_t)width*4,color,kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big);
    CGColorSpaceRelease(color);
    if (!context) { free(pixels); return NULL; }
    CGContextSetRGBFillColor(context,0,0,0,1);
    CGContextFillRect(context,CGRectMake(0,0,width,height));
    CGContextSetInterpolationQuality(context,kCGInterpolationHigh);
    CGContextDrawImage(context,CGRectMake(0,0,width,height),image);
    CGContextRelease(context);
    // Always export opaque screenshots; raw layout is RGB[A], row order preserved.
    for (size_t i=3;i<count;i+=4) pixels[i]=255;
    return pixels;
}
static int snapshot(SCContentFilter *filter,uint32_t width,uint32_t height,dispatch_time_t deadline,uint8_t **out) API_AVAILABLE(macos(14.0));
static int snapshot(SCContentFilter *filter,uint32_t width,uint32_t height,dispatch_time_t deadline,uint8_t **out) {
    if (!dimensions(width,height)) return 5;
    SCStreamConfiguration *configuration = [SCStreamConfiguration new];
    configuration.width=width; configuration.height=height;
    configuration.pixelFormat=kCVPixelFormatType_32BGRA; configuration.showsCursor=NO;
    BYDAsyncResult *result=[BYDAsyncResult new];
    [SCScreenshotManager captureImageWithFilter:filter configuration:configuration completionHandler:^(CGImageRef image,NSError *error){
        result.error=error;
        if (image) result.image=CGImageRetain(image);
        dispatch_semaphore_signal(result.gate);
    }];
    if (dispatch_semaphore_wait(result.gate,deadline)!=0) return 6;
    if (result.error || !result.image) return CGPreflightScreenCaptureAccess()?7:2;
    *out=imageRGBA(result.image,width,height);
    return *out?0:7;
}
int byd_capture_run(int windowMode,uint64_t target,int32_t ownPID,BYDImage *out) {
    if (!out) return 4;
    memset(out,0,sizeof(*out));
    @autoreleasepool {
        if (@available(macOS 14.0,*)) {
            int status=byd_capture_status(); if (status) return status;
            dispatch_time_t deadline=dispatch_time(DISPATCH_TIME_NOW,15*NSEC_PER_SEC);
            BYDAsyncResult *result=[BYDAsyncResult new];
            [SCShareableContent getShareableContentExcludingDesktopWindows:NO onScreenWindowsOnly:YES completionHandler:^(SCShareableContent *content,NSError *error){
                result.value=content;result.error=error;dispatch_semaphore_signal(result.gate);
            }];
            if (dispatch_semaphore_wait(result.gate,deadline)!=0) return 6;
            SCShareableContent *content=result.value;
            if (!content || result.error) return CGPreflightScreenCaptureAccess()?7:2;
            CGRect bounds=CGRectNull;
            double scale=1;
            for (SCDisplay *display in content.displays) {
                CGRect rect=CGDisplayBounds(display.displayID);
                if (CGRectIsEmpty(rect)) continue;
                bounds=CGRectIsNull(bounds)?rect:CGRectUnion(bounds,rect);
                double ratio=(double)CGDisplayPixelsWide(display.displayID)/rect.size.width;
                if (isfinite(ratio)&&ratio>=1) scale=fmax(scale,ratio);
            }
            if (CGRectIsNull(bounds) || scale>4) return 4;
            if (windowMode) {
                SCWindow *selected=nil;
                for (SCWindow *window in content.windows)
                    if (window.windowID==target && window.owningApplication.processID!=ownPID) { selected=window;break; }
                if (!selected) return 3;
                bounds=selected.frame;
                if (CGRectIsEmpty(bounds)) return 4;
                double fw=ceil(bounds.size.width*scale),fh=ceil(bounds.size.height*scale);
                if (!isfinite(fw)||!isfinite(fh)||fw>UINT32_MAX||fh>UINT32_MAX||!dimensions((uint32_t)fw,(uint32_t)fh)) return 5;
                out->width=(uint32_t)fw;out->height=(uint32_t)fh;
                SCContentFilter *filter=[[SCContentFilter alloc] initWithDesktopIndependentWindow:selected];
                status=snapshot(filter,out->width,out->height,deadline,&out->pixels);
                if (status) return status;
            } else {
                double fw=ceil(bounds.size.width*scale),fh=ceil(bounds.size.height*scale);
                if (!isfinite(fw)||!isfinite(fh)||fw>UINT32_MAX||fh>UINT32_MAX||!dimensions((uint32_t)fw,(uint32_t)fh)) return 5;
                out->width=(uint32_t)fw;out->height=(uint32_t)fh;
                out->pixels=calloc((size_t)out->width*out->height,4);if (!out->pixels) return 7;
                for (size_t i=3;i<(size_t)out->width*out->height*4;i+=4) out->pixels[i]=255;
                NSMutableArray<SCRunningApplication *> *excluded=[NSMutableArray new];
                for (SCRunningApplication *app in content.applications) if (app.processID==ownPID) [excluded addObject:app];
                for (SCDisplay *display in content.displays) {
                    CGRect rect=CGDisplayBounds(display.displayID);
                    if (CGRectIsEmpty(rect)) continue;
                    uint32_t width=(uint32_t)ceil(rect.size.width*scale),height=(uint32_t)ceil(rect.size.height*scale);
                    uint32_t left=(uint32_t)llround((rect.origin.x-bounds.origin.x)*scale),top=(uint32_t)llround((rect.origin.y-bounds.origin.y)*scale);
                    if (left>=out->width||top>=out->height) continue;
                    width=MIN(width,out->width-left);height=MIN(height,out->height-top);
                    SCContentFilter *filter=[[SCContentFilter alloc] initWithDisplay:display excludingApplications:excluded exceptingWindows:@[]];
                    uint8_t *pixels=NULL;status=snapshot(filter,width,height,deadline,&pixels);
                    if (status) { free(out->pixels);out->pixels=NULL;return status; }
                    for (uint32_t row=0;row<height;row++) memcpy(out->pixels+((size_t)(top+row)*out->width+left)*4,pixels+(size_t)row*width*4,(size_t)width*4);
                    free(pixels);
                }
            }
            out->length=(size_t)out->width*out->height*4;
            out->logical_x=bounds.origin.x;out->logical_y=bounds.origin.y;
            out->logical_width=bounds.size.width;out->logical_height=bounds.size.height;
            out->x=(int32_t)llround(bounds.origin.x*scale);out->y=(int32_t)llround(bounds.origin.y*scale);
            return 0;
        }
        return 1;
    }
}
void byd_capture_free(BYDImage *image) { if (image) { free(image->pixels); memset(image,0,sizeof(*image)); } }
// CI-only primitive verification: no display enumeration, TCC, screenshots, or UI.
int byd_capture_selftest(void) {
    uint8_t fixture[16]={255,0,0,255, 0,255,0,255, 0,0,255,255, 255,255,255,255};
    CGColorSpaceRef color=CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
    CGDataProviderRef provider=CGDataProviderCreateWithData(NULL,fixture,sizeof(fixture),NULL);
    CGImageRef image=CGImageCreate(2,2,8,32,8,color,kCGImageAlphaLast|kCGBitmapByteOrder32Big,provider,NULL,false,kCGRenderingIntentDefault);
    uint8_t *same=imageRGBA(image,2,2);uint8_t *scaled=imageRGBA(image,4,4);
    int ok=same&&scaled&&memcmp(fixture,same,sizeof(fixture))==0&&scaled[3]==255&&scaled[63]==255;
    free(same);free(scaled);CGImageRelease(image);CGDataProviderRelease(provider);CGColorSpaceRelease(color);
    return ok;
}
