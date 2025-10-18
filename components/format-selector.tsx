"use client"

import { useState } from "react"
import { Check, ChevronsUpDown, Music, Video } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { FileFormat } from "@/lib/types"
import { CONVERSION_OPTIONS } from "@/lib/types"
import { cn } from "@/lib/utils"

interface FormatSelectorProps {
  sourceFormat: FileFormat
  targetFormat: FileFormat | null
  onTargetFormatChange: (format: FileFormat) => void
}

const VIDEO_FORMATS: FileFormat[] = ["mp4", "webm", "avi", "mov", "mkv", "flv"]
const AUDIO_FORMATS: FileFormat[] = ["mp3", "wav", "ogg", "aac", "flac", "m4a"]

export function FormatSelector({ sourceFormat, targetFormat, onTargetFormatChange }: FormatSelectorProps) {
  const [open, setOpen] = useState(false)
  const availableFormats = CONVERSION_OPTIONS.find((opt) => opt.from === sourceFormat)?.to || []

  const videoFormats = availableFormats.filter((format) => VIDEO_FORMATS.includes(format))
  const audioFormats = availableFormats.filter((format) => AUDIO_FORMATS.includes(format))

  const handleSelect = (format: FileFormat) => {
    onTargetFormatChange(format)
    setOpen(false)
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="format-select">Convert to</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="format-select"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-transparent"
          >
            {targetFormat ? targetFormat.toUpperCase() : "Select output format"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search formats..." />
            <CommandList>
              <CommandEmpty>No format found.</CommandEmpty>

              {videoFormats.length > 0 && (
                <>
                  <CommandGroup
                    heading={
                      <div className="flex items-center gap-2">
                        <Video className="h-4 w-4" />
                        <span>Video</span>
                      </div>
                    }
                  >
                    {videoFormats.map((format) => (
                      <CommandItem key={format} value={format} onSelect={() => handleSelect(format)}>
                        <Check className={cn("mr-2 h-4 w-4", targetFormat === format ? "opacity-100" : "opacity-0")} />
                        {format.toUpperCase()}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  {audioFormats.length > 0 && <CommandSeparator />}
                </>
              )}

              {audioFormats.length > 0 && (
                <CommandGroup
                  heading={
                    <div className="flex items-center gap-2">
                      <Music className="h-4 w-4" />
                      <span>Audio</span>
                    </div>
                  }
                >
                  {audioFormats.map((format) => (
                    <CommandItem key={format} value={format} onSelect={() => handleSelect(format)}>
                      <Check className={cn("mr-2 h-4 w-4", targetFormat === format ? "opacity-100" : "opacity-0")} />
                      {format.toUpperCase()}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {videoFormats.length === 0 && audioFormats.length === 0 && (
                <CommandGroup>
                  {availableFormats.map((format) => (
                    <CommandItem key={format} value={format} onSelect={() => handleSelect(format)}>
                      <Check className={cn("mr-2 h-4 w-4", targetFormat === format ? "opacity-100" : "opacity-0")} />
                      {format.toUpperCase()}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
