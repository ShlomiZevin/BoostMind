@echo off
rem Face swap - any image's face onto your videos (faceswap.py says everything it does).
rem   faceswap.cmd "<video>" "<image>" [a^|c^|ai^|ai-best]
rem   faceswap.cmd "<Drop folder>" [a^|c^|ai^|ai-best]     every video in the folder, with the one image in it
py -3.12 "%~dp0faceswap.py" %*
